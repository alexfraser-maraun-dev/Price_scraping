import React from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../auth/AuthProvider';
import Logo from '../components/Logo';

const Login = () => {
    const theme = useTheme();
    const { login } = useAuth();

    return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#f8f9fa'
        }}>
            <Paper elevation={0} sx={{
                p: 6,
                maxWidth: 400,
                width: '100%',
                border: '1px solid #eef0f2',
                borderRadius: '16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <Box sx={{ mb: 4 }}>
                    <Logo />
                </Box>

                <Typography variant="body2" sx={{ color: '#5f6368', mb: 4 }}>
                    Please sign in with your corporate Google workspace account to continue.
                </Typography>

                <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={login}
                    sx={{
                        py: 1.5,
                        bgcolor: '#ffffff',
                        color: '#1a1a1a',
                        border: '1px solid #eef0f2',
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: '10px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        '&:hover': {
                            bgcolor: '#f8f9fa',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        }
                    }}
                    startIcon={
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"
                            alt="Google"
                            width="20"
                            height="20"
                        />
                    }
                >
                    Sign in with Google
                </Button>
            </Paper>
        </Box>
    );
};

export default Login;
