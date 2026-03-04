import React from 'react';
import { Box, Typography } from '@mui/material';
import biciMark from '../assets/bici-mark.png';


// The Squiggle Line from the screenshot
const PulseLine = ({ color = '#007b5e' }) => (
    <svg width="64" height="12" viewBox="0 0 64 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 6H12L18 0L30 12L36 2L42 6H64" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const Logo = () => {
    return (
        <Box display="flex" alignItems="center" gap={1.5}>
            <Box
                component="img"
                src={biciMark}
                alt="BICI"
                sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    objectFit: 'contain'
                }}
            />
            <Box display="flex" flexDirection="column" gap={0}>
                <Box display="flex" alignItems="center" gap={0.5}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        BICI
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#007b5e', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        Pulse
                    </Typography>
                    <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                        <PulseLine />
                    </Box>
                </Box>
                <Typography variant="caption" sx={{ color: '#5f6368', fontWeight: 500, letterSpacing: '0.05em', mt: 0.2 }}>
                    Price Comparison
                </Typography>
            </Box>
        </Box>
    );
};

export default Logo;
