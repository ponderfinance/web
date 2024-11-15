import { useState } from 'react'

interface UploadError extends Error {
  status?: number
  details?: string
}

interface UploadResponse {
  url: string
}

export function useIpfsUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<UploadError | null>(null)

  const uploadFileToIpfs = async (file: File): Promise<string> => {
    setIsUploading(true)
    setError(null)

    try {
      if (!file) {
        throw new Error('No file provided')
      }

      // Check file size (2GB limit)
      const maxSize = 2000 * 1024 * 1024
      if (file.size > maxSize) {
        throw new Error('File size exceeds 2GB limit')
      }

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/ipfs', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const error = new Error('Failed to upload file') as UploadError
        error.status = res.status
        error.details = errorData.error || 'Unknown error occurred'
        throw error
      }

      const data = (await res.json()) as UploadResponse
      return data.url
    } catch (err) {
      const error = err as UploadError
      setError(error)
      console.error('Error uploading to IPFS:', error)
      throw error
    } finally {
      setIsUploading(false)
    }
  }

  const uploadJsonToIpfs = async (json: unknown, filename: string): Promise<string> => {
    try {
      // Validate JSON
      const jsonString = JSON.stringify(json)
      JSON.parse(jsonString) // Will throw if invalid JSON

      const blob = new Blob([jsonString], { type: 'application/json' })
      const file = new File([blob], filename, { type: 'application/json' })

      return uploadFileToIpfs(file)
    } catch (err) {
      const error = new Error('Invalid JSON data') as UploadError
      setError(error)
      throw error
    }
  }

  return {
    isUploading,
    error,
    uploadFileToIpfs,
    uploadJsonToIpfs,
  }
}
