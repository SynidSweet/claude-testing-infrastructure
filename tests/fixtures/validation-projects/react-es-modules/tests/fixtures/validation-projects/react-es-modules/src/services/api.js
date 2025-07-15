export async function fetchUserData() {
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: '123',
        name: 'John Doe',
        email: 'john.doe@example.com'
      });
    }, 100);
  });
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
EOF < /dev/null