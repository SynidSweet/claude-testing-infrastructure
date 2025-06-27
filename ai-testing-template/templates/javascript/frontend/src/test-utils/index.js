import React from 'react';
import { render, queries } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Custom queries (extend default queries if needed)
const customQueries = {
  ...queries,
  // Add custom queries here if needed
};

/**
 * Create a new QueryClient for testing
 */
export const createTestQueryClient = () => 
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

/**
 * Test wrapper that includes common providers
 */
export const TestWrapper = ({ 
  children, 
  queryClient = createTestQueryClient(),
  initialRoute = '/',
  ...props 
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter initialEntries={[initialRoute]}>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

/**
 * Custom render function that includes providers
 */
export const renderWithProviders = (ui, options = {}) => {
  const {
    queryClient = createTestQueryClient(),
    initialRoute = '/',
    ...renderOptions
  } = options;

  const Wrapper = ({ children }) => (
    <TestWrapper 
      queryClient={queryClient} 
      initialRoute={initialRoute}
    >
      {children}
    </TestWrapper>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
};

/**
 * Render component with router only (no other providers)
 */
export const renderWithRouter = (ui, { initialRoute = '/' } = {}) => {
  const Wrapper = ({ children }) => (
    <BrowserRouter initialEntries={[initialRoute]}>
      {children}
    </BrowserRouter>
  );

  return render(ui, { wrapper: Wrapper });
};

/**
 * Create mock handlers for API calls
 */
export const createMockHandlers = (baseUrl = '/api') => ({
  get: (endpoint, response) =>
    jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => response,
    }),
  
  post: (endpoint, response) =>
    jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => response,
    }),
  
  put: (endpoint, response) =>
    jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => response,
    }),
  
  delete: (endpoint) =>
    jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
    }),
});

/**
 * Mock user interaction utilities
 */
export const userInteractions = {
  // Type in an input field
  typeInInput: async (user, input, text) => {
    await user.clear(input);
    await user.type(input, text);
  },

  // Select option from dropdown
  selectOption: async (user, select, option) => {
    await user.selectOptions(select, option);
  },

  // Click and wait
  clickAndWait: async (user, element, waitForElement) => {
    await user.click(element);
    if (waitForElement) {
      await waitForElement();
    }
  },
};

/**
 * Common test data factories
 */
export const createTestData = {
  user: (overrides = {}) => ({
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    ...overrides,
  }),

  product: (overrides = {}) => ({
    id: '1',
    name: 'Test Product',
    price: 99.99,
    description: 'Test product description',
    inStock: true,
    ...overrides,
  }),

  apiResponse: (data, overrides = {}) => ({
    success: true,
    data,
    message: 'Success',
    ...overrides,
  }),
};

/**
 * Wait for element to appear/disappear utilities
 */
export const waitForElement = {
  toAppear: async (getElement) => {
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const element = getElement();
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  },

  toDisappear: async (element) => {
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (!document.contains(element)) {
          observer.disconnect();
          resolve();
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  },
};

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';