import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Products from './pages/Products';
import Reports from './pages/Reports';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

// --- Premium Dark Theme Configuration ---
const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        background: {
            default: '#0a0a0a',
            paper: '#121212',
        },
        primary: {
            main: '#00e599', // Cyan/Green highlight
        },
        secondary: {
            main: '#292929',
        },
        text: {
            primary: '#ffffff',
            secondary: '#a0a0a0',
        },
        success: {
            main: '#00e599',
        },
        error: {
            main: '#ff4d4d',
        }
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h5: { fontWeight: 600 },
        subtitle2: { letterSpacing: '0.05em' }
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid #1f1f1f',
                    borderRadius: '12px',
                },
            },
        },
        MuiDataGrid: {
            styleOverrides: {
                root: {
                    border: 'none',
                    '& .MuiDataGrid-cell': {
                        borderBottom: '1px solid #1f1f1f',
                    },
                    '& .MuiDataGrid-columnHeaders': {
                        borderBottom: '1px solid #1f1f1f',
                        backgroundColor: '#0a0a0a',
                        color: '#a0a0a0',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em',
                        fontWeight: 600
                    },
                    '& .MuiDataGrid-footerContainer': {
                        borderTop: '1px solid #1f1f1f',
                    },
                },
            },
        },
    },
});

const App = () => {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Products />} />
                    <Route path="reports" element={<Reports />} />
                </Route>
            </Routes>
        </ThemeProvider>
    );
};

export default App;
