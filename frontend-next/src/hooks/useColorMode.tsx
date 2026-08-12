'use client'



import React, { createContext, useContext, useState, useEffect } from 'react'

export type ColorMode = 'light' | 'dark' | 'system'

interface ColorModeContextType {
  colorMode: ColorMode
  resolvedColorMode: 'light' | 'dark'
  setColorMode: (mode: ColorMode) => void
}

const ColorModeContext = createContext<ColorModeContextType | undefined>(undefined)

export const ColorModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorMode, setColorModeState] = useState<ColorMode>('system')

  // Initialize from localStorage after mount (client-only)
  useEffect(() => {
    const saved = localStorage.getItem('lightwing_color_mode')
    if (saved) {
      setColorModeState(saved as ColorMode)
    }
  }, [])

  const [resolvedColorMode, setResolvedColorMode] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const updateResolved = () => {
      if (colorMode === 'system') {
        setResolvedColorMode(mediaQuery.matches ? 'dark' : 'light')
      } else {
        setResolvedColorMode(colorMode)
      }
    }

    updateResolved()

    if (colorMode === 'system') {
      mediaQuery.addEventListener('change', updateResolved)
      return () => mediaQuery.removeEventListener('change', updateResolved)
    }
  }, [colorMode])

  useEffect(() => {
    document.documentElement.setAttribute('data-color-mode', resolvedColorMode)
  }, [resolvedColorMode])

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode)
    localStorage.setItem('lightwing_color_mode', mode)
  }

  return (
    <ColorModeContext.Provider value={{ colorMode, resolvedColorMode, setColorMode }}>
      {children}
    </ColorModeContext.Provider>
  )
}

export const useColorMode = () => {
  const context = useContext(ColorModeContext)
  if (!context) {
    throw new Error('useColorMode must be used within a ColorModeProvider')
  }
  return context
}