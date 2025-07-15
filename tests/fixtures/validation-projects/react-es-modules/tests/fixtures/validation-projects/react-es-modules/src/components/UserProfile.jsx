export default function UserProfile({ user }) {
  if (\!user) {
    return <div>No user data available</div>;
  }

  return (
    <div className="user-profile" data-testid="user-profile">
      <h3>{user.name}</h3>
      <p>Email: {user.email}</p>
      <p>ID: {user.id}</p>
    </div>
  );
}
EOF < /dev/null