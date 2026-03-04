import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Reports = () => {
    return (
        <Box sx={{ p: 3, pt: 4 }}>
            <Typography variant="h5" mb={3} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                BICIPulse Reports
            </Typography>
            <Paper sx={{ p: 4, height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                    Historical Pricing Chart will be implemented here.
                </Typography>
            </Paper>
        </Box>
    );
};

export default Reports;
