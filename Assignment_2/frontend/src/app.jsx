import { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function App() {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  // Fetch previously uploaded images when the page opens.
  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/images`);
      setImages(response.data.images || []);
    } catch (error) {
      showMessage(
        error.response?.data?.message || "Could not load images. Is the backend running?",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  // Display a temporary preview of the selected local image.
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    setMessage("");

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      showMessage("Choose a JPG, PNG, GIF, or WEBP image.", "error");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showMessage("Image size must be 5 MB or less.", "error");
      event.target.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showMessage("Please choose an image first.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      setUploading(true);
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      showMessage(response.data.message || "Image uploaded successfully.");
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchImages();
    } catch (error) {
      showMessage(
        error.response?.data?.message || "Image upload failed. Please try again.",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename) => {
    const shouldDelete = window.confirm("Do you want to delete this image?");
    if (!shouldDelete) return;

    try {
      await axios.delete(`${API_URL}/images/${encodeURIComponent(filename)}`);
      setImages((currentImages) =>
        currentImages.filter((image) => image.filename !== filename)
      );
      showMessage("Image deleted successfully.");
    } catch (error) {
      showMessage(
        error.response?.data?.message || "Could not delete this image.",
        "error"
      );
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage("");
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">IS</span>
          <span>Image<span className="brand-light">Studio</span></span>
        </a>
        <span className="topbar-label">SKILL NEXIS · WEEK 3</span>
      </header>

      <section className="intro">
        <p className="eyebrow">ASSIGNMENT 02</p>
        <h1>Image Upload <span>Feature</span></h1>
        <p className="intro-text">
          Upload, preview, and manage your images in one simple workspace.
        </p>
      </section>

      <section className="workspace">
        <div className="upload-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">UPLOAD CENTER</p>
              <h2>Add a new image</h2>
            </div>
            <span className="step-number">01</span>
          </div>

          <label className="dropzone" htmlFor="image-input">
            <span className="upload-icon">↑</span>
            <strong>Choose an image to upload</strong>
            <span>Click here to browse your device</span>
            <small>JPG, PNG, GIF or WEBP · Maximum 5 MB</small>
            <input
              ref={fileInputRef}
              id="image-input"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
            />
          </label>

          {previewUrl && (
            <div className="preview-panel">
              <div className="preview-heading">
                <strong>Image preview</strong>
                <button className="text-button" onClick={clearSelection} type="button">
                  Remove
                </button>
              </div>
              <img className="preview-image" src={previewUrl} alt="Selected image preview" />
              <div className="file-details">
                <span>{selectedFile?.name}</span>
                <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
              <button
                className="primary-button upload-button"
                onClick={handleUpload}
                disabled={uploading}
                type="button"
              >
                {uploading ? "Uploading..." : "Upload image"}
              </button>
            </div>
          )}

          {message && (
            <div className={`message ${messageType}`} role="status">
              {message}
            </div>
          )}
        </div>

        <div className="gallery-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR COLLECTION</p>
              <h2>Uploaded images</h2>
            </div>
            <span className="count-pill">{images.length} images</span>
          </div>

          {loading ? (
            <div className="empty-state">Loading your images...</div>
          ) : images.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">▧</span>
              <strong>Your gallery is empty</strong>
              <p>Images you upload will appear here.</p>
            </div>
          ) : (
            <div className="image-grid">
              {images.map((image) => (
                <article className="image-card" key={image.filename}>
                  <a href={image.url} target="_blank" rel="noreferrer">
                    <img src={image.url} alt={image.filename} loading="lazy" />
                  </a>
                  <div className="image-card-footer">
                    <span title={image.filename}>{image.filename}</span>
                    <button
                      className="delete-button"
                      onClick={() => handleDelete(image.filename)}
                      type="button"
                      aria-label={`Delete ${image.filename}`}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="footer">
        <span>ImageStudio</span>
        <span>Built with React · Express · Multer</span>
      </footer>
    </main>
  );
}

export default App;
