import React, { useState, useRef, useEffect } from "react";
import "./ChatAssistant.css";
import OpenAI from "openai";
import { Transition } from "react-transition-group";
import Markdown from "react-markdown";

const API_KEY = process.env.REACT_APP_OAI_KEY;
const ASSISTANT_ID = process.env.REACT_APP_ASS_ID;

const client = new OpenAI({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true,
});

const defaultStyles = {
  transition: `opacity 300ms ease-in-out`,
  opacity: 0,
};

const transitionStyles = {
  entering: { opacity: 1 },
  entered: { opacity: 1 },
  exiting: { opacity: 0 },
  exited: { opacity: 0 },
};

const ChatAssistant = () => {
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "Cześć! Jestem asystentem, który pomoże Ci napisać idealne ogłoszenie! 🚀",
    },
  ]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamedMessage, setStreamedMessage] = useState("");
  const chatHistoryRef = useRef(null);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;

      // Nadaj klasę `.appear` z małym opóźnieniem
      const bubbles = chatHistoryRef.current.querySelectorAll(".chat-bubble");
      if (bubbles.length > 0) {
        const last = bubbles[bubbles.length - 1];
        setTimeout(() => {
          last.classList.add("appear");
        }, 50); // delikatne opóźnienie do zainicjowania CSS transition
      }
    }
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // 1. Utwórz nowy thread (jeśli pierwszy raz)
      let currentThreadId = threadId;
      if (!currentThreadId) {
        const threadRes = await client.beta.threads.create();
        currentThreadId = threadRes.id;
        setThreadId(currentThreadId);
      }

      // 2. Dodaj wiadomość użytkownika do threadu
      await client.beta.threads.messages.create(currentThreadId, {
        role: "user",
        content: userMessage.text,
      });

      // 3. Uruchom run z assistantem
      const stream = await client.beta.threads.runs.create(currentThreadId, {
        assistant_id: ASSISTANT_ID,
        stream: true,
      });

      let contentOfResponse = "";
      for await (const event of stream) {
        if (event.event === "thread.message.delta") {
          const token = event.data.delta.content[0].text.value;
          if (token) {
            contentOfResponse = contentOfResponse + token;
            setStreamedMessage(contentOfResponse);
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: contentOfResponse },
      ]);

      setStreamedMessage(false);
    } catch (err) {
      console.log(err);
    }

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div className="chat-container">
      <div className="chat-history" ref={chatHistoryRef}>
        <h1 style={{ marginTop: 10, marginBottom: 50, color: "white" }}>
          Agent AI - ogłoszenia (v0.0.1 beta)
        </h1>
        {messages.map((msg, idx) => (
          <div className={`chat-wrapper ${msg.sender}`}>
            <div
              key={idx}
              className={`chat-bubble ${
                msg.sender === "ai" ? msg.sender : `${msg.sender} appear`
              }`}
            >
              <Markdown>{msg.text}</Markdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble ai">
            {streamedMessage ? (
              <Transition in={streamedMessage} timeout={300}>
                {(state) => (
                  <span
                    styles={{ ...defaultStyles, ...transitionStyles[state] }}
                  >
                    {streamedMessage}
                  </span>
                )}
              </Transition>
            ) : (
              "Myślę..."
            )}
          </div>
        )}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Zadaj pytanie asystentowi..."
        />
        <button onClick={sendMessage}>Wyślij</button>
      </div>
    </div>
  );
};

export default ChatAssistant;
