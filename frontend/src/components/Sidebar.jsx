import React from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useLocation, useNavigate } from 'react-router-dom';

import Logo from './Logo';

const navItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard_placeholder' },
    { text: 'Products', icon: <Inventory2Icon />, path: '/' },
    { text: 'Dynamic Pricing', icon: <TrendingUpIcon />, path: '/pricing_placeholder' },
    { text: 'Reports', icon: <BarChartIcon />, path: '/reports' },
];

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <Box sx={{
            width: 240,
            borderRight: '1px solid #eef0f2',
            bgcolor: '#ffffff',
            height: '100vh',
            position: 'sticky',
            top: 0,
            display: 'flex',
            flexDirection: 'column',
            p: 2,
            pt: 4
        }}>
            <List sx={{ mt: 2 }}>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                            <ListItemButton
                                onClick={() => navigate(item.path)}
                                sx={{
                                    borderRadius: '10px',
                                    py: 1.25,
                                    bgcolor: isActive ? 'rgba(0, 123, 94, 0.08)' : 'transparent',
                                    color: isActive ? '#007b5e' : '#5f6368',
                                    '&.Mui-selected': {
                                        bgcolor: 'rgba(0, 123, 94, 0.08)',
                                        '&:hover': {
                                            bgcolor: 'rgba(0, 123, 94, 0.12)',
                                        }
                                    },
                                    '&:hover': {
                                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                                    }
                                }}
                            >
                                <ListItemIcon sx={{
                                    color: isActive ? '#007b5e' : '#5f6368',
                                    minWidth: 40
                                }}>
                                    {React.cloneElement(item.icon, { fontSize: 'small' })}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                        fontSize: '0.875rem',
                                        fontWeight: isActive ? 700 : 500
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        </Box>
    );
};

export default Sidebar;
