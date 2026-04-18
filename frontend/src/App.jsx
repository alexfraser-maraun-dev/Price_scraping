import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Products from './pages/Products';
import Reports from './pages/Reports';
import Login from './pages/Login';
import { AuthProvider } from './auth/AuthProvider';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import ErrorBoundary from './components/ErrorBoundary';

// --- Premium Light Theme Configuration (v2) ---
const lightTheme = createTheme({
    palette: {
        mode: 'light',
        background: {
            default: '#ffffff',
            paper: '#ffffff',
        },
        primary: {
            main: '#007b5e', // Bici Green
        },
        secondary: {
            main: '#f1f3f5',
        },
        text: {
            primary: '#1a1a1a',
            secondary: '#5f6368',
        },
        success: {
            main: '#007b5e',
        },
        error: {
            main: '#dc3545',
        }
    },
    typography: {
        fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif',
        h4: { fontWeight: 700, letterSpacing: '-0.02em' },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
        body1: { fontSize: '0.925rem' },
        body2: { fontSize: '0.85rem' },
        caption: { fontSize: '0.75rem' }
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: '#ffffff',
                }
            }
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    padding: '8px 20px',
                },
                containedPrimary: {
                    backgroundColor: '#007b5e',
                    '&:hover': {
                        backgroundColor: '#00624a',
                    }
                }
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid #eef0f2',
                    borderRadius: '16px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                },
            },
        },
        MuiDataGrid: {
            styleOverrides: {
                root: {
                    border: 'none',
                    fontFamily: '"Inter", sans-serif',
                    '& .MuiDataGrid-columnHeaderTitle': {
                        fontWeight: 700,
                        color: '#5f6368',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    },
                    '& .MuiDataGrid-columnHeaders': {
                        backgroundColor: '#f8f9fa',
                        borderBottom: '1px solid #eef0f2',
                    },
                    '& .MuiDataGrid-cell': {
                        borderBottom: '1px solid #f8f9fa',
                        color: '#1a1a1a',
                    },
                    '& .MuiDataGrid-row:hover': {
                        backgroundColor: '#f8f9fa',
                    }
                },
            },
        },
    },
});

const App = () => {
    return (
        <ThemeProvider theme={lightTheme}>
            <CssBaseline />
            <ErrorBoundary>
                <AuthProvider>
                    <Routes>
                        <Route path="/" element={<Layout />}>
                            <Route index element={<Products />} />
                            <Route path="reports" element={<Reports />} />
                        </Route>
                    </Routes>
                </AuthProvider>
            </ErrorBoundary>
        </ThemeProvider>
    );
};

export default App;
