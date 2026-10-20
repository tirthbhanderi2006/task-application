import React from "react";

export default function Footer() {
  return (
    <footer className="main-footer">
      <div className="footer-container">
        <div className="footer-copyright" style={{ textAlign: "center", width: "100%" }}>
          &copy; {new Date().getFullYear()} Task Management App. All rights reserved.
        </div>
      </div>
    </footer>
  );
}