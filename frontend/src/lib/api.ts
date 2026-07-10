import Client, { Local } from './client'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? Local

export const appClient = new Client(API_BASE_URL)
