import React from 'react';

const AdminLoginForm = () => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Admin Email</label>
      <input 
        id="email" 
        type="email" 
        name="email" 
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required 
        placeholder="admin@example.com"
      />
      
      <label htmlFor="password">Password</label>
      <input 
        id="password" 
        type="password" 
        name="password" 
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required 
        placeholder="Password"
      />
      
      <button 
        type="submit" 
        disabled={!email || !password}
      >
        Sign In to Admin Portal
      </button>
    </form>
  );
};

export default AdminLoginForm;
