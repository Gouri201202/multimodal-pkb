import React, { useState, useRef, useEffect } from "react";
import "./Chatbot.css";

const Chatbot = ({ variant = "floating" }) => {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! Ask me anything about your knowledge base.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [relevantItems, setRelevantItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response },
        ]);
        setRelevantItems(data.relevantItems || []);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
          },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to send message. Please check your connection.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Inline variant (for header)
  if (variant === "inline") {
    return (
      <>
        <button
          className="chatbot-toggle-inline"
          onClick={() => setIsOpen(!isOpen)}
        >
          💬 AI Assistant
        </button>

        {isOpen && (
          <div className="chatbot-container-inline">
            <div className="chatbot-header">
              <h3>💡 Knowledge Base Assistant</h3>
              <button onClick={() => setIsOpen(false)}>✕</button>
            </div>

            <div className="chatbot-messages">
              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))}
              {loading && (
                <div className="message assistant">
                  <div className="message-content typing">Thinking...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {relevantItems.length > 0 && (
              <div className="relevant-items">
                <h4>📂 Related Items:</h4>
                {relevantItems.map((item) => (
                  <div key={item._id} className="relevant-item">
                    <span className="item-type">{item.type}</span>
                    <span className="item-title">{item.title}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="chatbot-input">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask about your notes..."
                disabled={loading}
              />
              <button onClick={sendMessage} disabled={loading || !input.trim()}>
                Send
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Floating variant (original)
  return (
    <>
      <button className="chatbot-toggle" onClick={() => setIsOpen(!isOpen)}>
        💬
      </button>

      {isOpen && (
        <div className="chatbot-container">
          {/* Same content as inline variant */}
          <div className="chatbot-header">
            <h3>💡 Knowledge Base Assistant</h3>
            <button onClick={() => setIsOpen(false)}>✕</button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="message assistant">
                <div className="message-content typing">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {relevantItems.length > 0 && (
            <div className="relevant-items">
              <h4>📂 Related Items:</h4>
              {relevantItems.map((item) => (
                <div key={item._id} className="relevant-item">
                  <span className="item-type">{item.type}</span>
                  <span className="item-title">{item.title}</span>
                </div>
              ))}
            </div>
          )}

          <div className="chatbot-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask about your notes..."
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
