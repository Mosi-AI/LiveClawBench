import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import EmailDetail from './components/EmailDetail'
import Compose from './components/Compose'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div className="App">
      <Routes>
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/" />}
        />
        <Route
          path="/register"
          element={!user ? <Register /> : <Navigate to="/" />}
        />
        <Route
          path="/"
          element={user ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/emails/:id"
          element={user ? <EmailDetail /> : <Navigate to="/login" />}
        />
        <Route
          path="/compose"
          element={user ? <Compose /> : <Navigate to="/login" />}
        />
        <Route
          path="/compose/:draftId"
          element={user ? <Compose /> : <Navigate to="/login" />}
        />
      </Routes>
    </div>
  )
}

export default App
