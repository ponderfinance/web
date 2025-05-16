# GraphQL/Relay Usage Guidelines

This document outlines the proper patterns for working with GraphQL in our application using Relay.

## Core Principles

1. **One query per page** - Each page should have a single top-level query that fetches all necessary data
2. **Components use fragments** - Components should define their data needs via fragments
3. **No direct fetch calls** - Never use direct `fetch('/api/graphql')` calls
4. **Consistent loading patterns** - Use Relay's loading utilities instead of manual loading states

## Recommended Pattern

### 1. Define a single query at the page level

```tsx
// In PageComponent.tsx
export const PageQuery = graphql`
  query PageComponentQuery($id: ID!) {
    entity(id: $id) {
      ...ComponentA_data
      ...ComponentB_data
      # Include fragments for all child components
    }
  }
`;

export default function PageComponent({ id }: { id: string }) {
  const [queryRef, loadQuery] = useQueryLoader<PageComponentQuery>(PageQuery);
  
  useEffect(() => {
    loadQuery({ id });
  }, [id, loadQuery]);
  
  if (!queryRef) {
    return <LoadingSkeleton />;
  }
  
  return <PageContent queryRef={queryRef} />;
}

function PageContent({ queryRef }: { queryRef: PreloadedQuery<PageComponentQuery> }) {
  const data = useLazyLoadQuery<PageComponentQuery>(
    PageQuery,
    { id: queryRef.variables.id as string },
    { fetchPolicy: 'store-or-network' }
  );
  
  return (
    <>
      <ComponentA dataRef={data.entity} />
      <ComponentB dataRef={data.entity} />
    </>
  );
}
```

### 2. Define fragments for each component

```tsx
// In ComponentA.tsx
export const fragment = graphql`
  fragment ComponentA_data on Entity {
    field1
    field2
    nestedField {
      subField
    }
  }
`;

function ComponentA({ dataRef }: { dataRef: ComponentA_data$key }) {
  const data = useFragment(fragment, dataRef);
  
  return (
    <div>
      <h2>{data.field1}</h2>
      <p>{data.field2}</p>
    </div>
  );
}
```

### 3. Handle data loading and error states

```tsx
function LoadingSkeleton() {
  return (
    // Your loading UI here
  );
}

function ErrorComponent({ message }: { message: string }) {
  return (
    <div>
      <h2>Error:</h2>
      <p>{message}</p>
    </div>
  );
}
```

### 4. Handle data updates (Redis notifications)

```tsx
// In the parent component that loads the query
useEffect(() => {
  if (redisUpdateNotification && queryRef) {
    // Refresh data with store-and-network to use cache first
    loadQuery(
      { id },
      { fetchPolicy: 'store-and-network' }
    );
  }
}, [redisUpdateNotification, queryRef, loadQuery, id]);
```

## Examples in Our Codebase

For examples of the proper pattern, refer to:

1. `TokenDetailContent.tsx` - Shows proper fragment usage and query loading
2. `TokenPair.tsx` - Demonstrates component-level fragments
3. `TokenDetailClient.tsx` - Shows refactored code using the proper pattern

## Anti-Patterns to Avoid

1. ❌ **Multiple direct fetch calls** - Don't make separate fetch calls for different pieces of data
2. ❌ **Manual loading state management** - Don't use multiple loading state variables
3. ❌ **Ad-hoc query strings** - Don't define GraphQL queries as template literals
4. ❌ **Custom data fetching hooks** - Don't create hooks like `useTokenData` that duplicate Relay's functionality

## Benefits of Following These Guidelines

1. **Minimized network requests** - One query per page instead of multiple
2. **Automatic caching** - Relay handles caching data
3. **Consistent loading states** - Predictable loading behavior
4. **Type safety** - Generated types for queries and fragments
5. **Improved performance** - Better data normalization and updates
6. **Easier testing** - More predictable data flow
7. **Better developer experience** - Clearer code organization

## When Refreshing Data

1. Use `store-and-network` fetch policy to prevent UI flicker
2. Avoid setting loading states manually during refreshes
3. Use Relay's environment for direct store updates when possible
4. Consider throttling frequent updates with debounce/throttle utilities 