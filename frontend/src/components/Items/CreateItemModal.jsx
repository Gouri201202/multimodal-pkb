import React, { useState, useEffect } from "react";
import { itemsAPI } from "../../services/api";
import "./CreateItemModal.css";

const CreateItemModal = ({ isOpen, onClose, onCreated }) => {
  const [activeTab, setActiveTab] = useState("text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Text Note State
  const [textData, setTextData] = useState({
    title: "",
    content: "",
    tags: "",
  });

  // Image/Document State
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState("");
  const [fileTitle, setFileTitle] = useState("");
  const [fileTags, setFileTags] = useState("");

  // Voice Recording State (with transcription)
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState("");
  const [transcription, setTranscription] = useState("");
  const [audioTitle, setAudioTitle] = useState("");
  const [audioTags, setAudioTags] = useState("");
  const [recognition, setRecognition] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = "en-US";

      recognitionInstance.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }
        setTranscription((prev) => prev + finalTranscript);
      };

      recognitionInstance.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== "no-speech") {
          setError("Speech recognition error: " + event.error);
        }
      };

      setRecognition(recognitionInstance);
    } else {
      console.warn("Speech recognition not supported");
    }
  }, []);

  if (!isOpen) return null;

  // Handle Text Note Submission
  const handleTextSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await itemsAPI.create({
        title: textData.title,
        content: textData.content,
        userTags: textData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag),
      });

      setTextData({ title: "", content: "", tags: "" });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create note");
    } finally {
      setLoading(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);

      // Create preview for images
      if (selectedFile.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setFilePreview("");
      }
    }
  };

  // Handle Image Upload
  const handleImageSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an image");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("title", fileTitle || file.name);
      formData.append("userTags", fileTags);

      await itemsAPI.uploadImage(formData);

      setFile(null);
      setFilePreview("");
      setFileTitle("");
      setFileTags("");
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to upload image");
    } finally {
      setLoading(false);
    }
  };

  // Handle Document Upload
  const handleDocumentSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a document");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("title", fileTitle || file.name);
      formData.append("userTags", fileTags);

      await itemsAPI.uploadDocument(formData);

      setFile(null);
      setFilePreview("");
      setFileTitle("");
      setFileTags("");
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to upload document");
    } finally {
      setLoading(false);
    }
  };

  // Start Recording (with transcription)
  const startRecording = async () => {
    try {
      setError("");
      setTranscription("");

      // Start audio recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks = [];

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioBlobUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);

      // Start speech recognition
      if (recognition) {
        recognition.start();
      }

      setIsRecording(true);
    } catch (err) {
      setError("Failed to start recording: " + err.message);
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

    if (recognition) {
      recognition.stop();
    }

    setIsRecording(false);
  };

  // Clear Recording
  const clearRecording = () => {
    setAudioBlob(null);
    setAudioBlobUrl("");
    setTranscription("");
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
    }
  };

  // Handle Voice Note Upload
  const handleVoiceSubmit = async (e) => {
    e.preventDefault();

    if (!audioBlob) {
      setError("Please record audio first");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const audioFile = new File([audioBlob], "voice-note.webm", {
        type: "audio/webm",
      });

      const formData = new FormData();
      formData.append("audio", audioFile);
      formData.append("title", audioTitle || "Voice Note");
      formData.append("userTags", audioTags);
      formData.append("transcription", transcription); // ✅ Send transcription!

      await itemsAPI.uploadVoice(formData);

      clearRecording();
      setAudioTitle("");
      setAudioTags("");
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to upload voice note");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Item</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === "text" ? "active" : ""}`}
            onClick={() => setActiveTab("text")}
          >
            📝 Text
          </button>
          <button
            className={`tab-btn ${activeTab === "image" ? "active" : ""}`}
            onClick={() => setActiveTab("image")}
          >
            🖼️ Image
          </button>
          <button
            className={`tab-btn ${activeTab === "document" ? "active" : ""}`}
            onClick={() => setActiveTab("document")}
          >
            📄 PDF
          </button>
          <button
            className={`tab-btn ${activeTab === "voice" ? "active" : ""}`}
            onClick={() => setActiveTab("voice")}
          >
            🎤 Voice
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="modal-body">
          {/* TEXT NOTE TAB */}
          {activeTab === "text" && (
            <form onSubmit={handleTextSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={textData.title}
                  onChange={(e) =>
                    setTextData({ ...textData, title: e.target.value })
                  }
                  placeholder="Enter title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Content *</label>
                <textarea
                  value={textData.content}
                  onChange={(e) =>
                    setTextData({ ...textData, content: e.target.value })
                  }
                  placeholder="Write your note here..."
                  rows="8"
                  required
                />
              </div>

              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={textData.tags}
                  onChange={(e) =>
                    setTextData({ ...textData, tags: e.target.value })
                  }
                  placeholder="e.g. research, AI, notes"
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Creating..." : "Create Note"}
              </button>
            </form>
          )}

          {/* IMAGE TAB */}
          {activeTab === "image" && (
            <form onSubmit={handleImageSubmit}>
              <div className="form-group">
                <label>Upload Image *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  required
                />
              </div>

              {filePreview && (
                <div className="image-preview">
                  <img src={filePreview} alt="Preview" />
                </div>
              )}

              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  placeholder="Enter image title"
                />
              </div>

              <div className="form-group">
                <label>Tags</label>
                <input
                  type="text"
                  value={fileTags}
                  onChange={(e) => setFileTags(e.target.value)}
                  placeholder="e.g. screenshot, diagram"
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Uploading..." : "Upload Image"}
              </button>
            </form>
          )}

          {/* DOCUMENT TAB */}
          {activeTab === "document" && (
            <form onSubmit={handleDocumentSubmit}>
              <div className="form-group">
                <label>Upload PDF *</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  required
                />
              </div>

              {file && (
                <div className="file-info">
                  📄 {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </div>
              )}

              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  placeholder="Enter document title"
                />
              </div>

              <div className="form-group">
                <label>Tags</label>
                <input
                  type="text"
                  value={fileTags}
                  onChange={(e) => setFileTags(e.target.value)}
                  placeholder="e.g. research, paper"
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Uploading..." : "Upload PDF"}
              </button>
            </form>
          )}

          {/* VOICE NOTE TAB */}
          {activeTab === "voice" && (
            <form onSubmit={handleVoiceSubmit}>
              <div className="voice-recorder">
                <div className="recorder-status">
                  Status: <strong>{isRecording ? "RECORDING" : "READY"}</strong>
                </div>

                {/* Recording Controls */}
                <div className="recorder-controls">
                  {!isRecording ? (
                    <button
                      type="button"
                      className="record-btn"
                      onClick={startRecording}
                    >
                      🔴 Start Recording
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="stop-btn"
                      onClick={stopRecording}
                    >
                      ⏹️ Stop Recording
                    </button>
                  )}
                </div>

                {/* Real-time Transcription Display */}
                {(isRecording || transcription) && (
                  <div className="transcription-box">
                    <strong>Live Transcription:</strong>
                    <p>{transcription || "Listening..."}</p>
                  </div>
                )}

                {/* Audio Player */}
                {audioBlobUrl && (
                  <div className="audio-player">
                    <audio src={audioBlobUrl} controls />
                    <button
                      type="button"
                      className="clear-btn"
                      onClick={clearRecording}
                    >
                      🗑️ Clear & Re-record
                    </button>
                  </div>
                )}
              </div>

              {/* Title & Tags */}
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  placeholder="Voice note title"
                />
              </div>

              <div className="form-group">
                <label>Tags</label>
                <input
                  type="text"
                  value={audioTags}
                  onChange={(e) => setAudioTags(e.target.value)}
                  placeholder="e.g. meeting, idea"
                />
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={loading || !audioBlob}
              >
                {loading ? "Uploading..." : "Upload Voice Note"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateItemModal;
