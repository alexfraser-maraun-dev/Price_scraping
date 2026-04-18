import React from 'react';
import { Box, Typography, Button } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '100vh', p: 4, bgcolor: '#fff8f8'
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#dc3545', mb: 2 }}>
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {this.state.error?.toString()}
          </Typography>
          <Box
            component="pre"
            sx={{
              bgcolor: '#f8f9fa', border: '1px solid #eef0f2', borderRadius: 2,
              p: 2, fontSize: '0.72rem', maxWidth: '90vw', overflow: 'auto',
              mb: 3, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
            }}
          >
            {this.state.info?.componentStack}
          </Box>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
