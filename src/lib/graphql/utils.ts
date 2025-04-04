// Helper function to create cursor-based pagination
export const createCursorPagination = <T extends { id: string | { toString: () => string } }>(
  items: T[],
  first: number,
  cursorId?: string
) => {
  try {
    // Create the edges with cursors
    const edges = items.map((item) => ({
      node: item,
      // Create a cursor from the item ID, handling both string and ObjectId types
      cursor: Buffer.from(typeof item.id === 'string' ? item.id : item.id.toString()).toString('base64'),
    }))

    // Check if there are more results by comparing the requested count with the result count
    const hasNextPage = items.length > first
    // Remove the extra item we fetched to check for more results
    const limitedEdges = hasNextPage ? edges.slice(0, first) : edges

    // Determine if there's a previous page - true if a cursor was provided
    const hasPreviousPage = Boolean(cursorId)

    return {
      edges: limitedEdges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
        startCursor: limitedEdges.length > 0 ? limitedEdges[0].cursor : null,
        endCursor:
          limitedEdges.length > 0 ? limitedEdges[limitedEdges.length - 1].cursor : null,
      },
    }
  } catch (error) {
    console.error('Error creating pagination:', error)
    return {
      edges: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
    }
  }
}

// Helper to decode a cursor
export const decodeCursor = (cursor: string): string => {
  try {
    return Buffer.from(cursor, 'base64').toString('utf-8')
  } catch (e) {
    throw new Error(`Invalid cursor: ${cursor}`)
  }
} 