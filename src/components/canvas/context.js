import { createContext, useContext } from 'react'

/** Lets any node on the canvas reach the gesture engine without prop drilling. */
export const CanvasContext = createContext(null)

export const useCanvas = () => useContext(CanvasContext)
