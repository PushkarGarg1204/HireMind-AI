import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import "./features/auth/auth.form.scss";
import "./style/button.scss";
import "./style.scss"
import { AuthProvider } from "./features/auth/auth.context";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)