import React from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useLocation, useNavigate } from 'react-router-dom';

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
            width: 250,
            borderRight: '1px solid #1f1f1f',
            bgcolor: '#0a0a0a',
            height: '100vh',
            position: 'sticky',
            top: 0,
            display: 'flex',
            flexDirection: 'column',
            p: 2
        }}>
            <Box display="flex" alignItems="center" gap={1.5} mb={4} px={1}>
                <Box sx={{
                    bgcolor: '#00e599',
                    width: 32, height: 32,
                    borderRadius: 1.5,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <TrendingUpIcon sx={{ color: '#000', fontSize: 20 }} />
                </Box>
                <Typography variant="h6" fontWeight="bold">BICI</Typography>
            </Box>

            <List>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                            <ListItemButton
                                onClick={() => navigate(item.path)}
                                selected={isActive}
                                sx={{
                                    borderRadius: 2,
                                    '&.Mui-selected': {
                                        bgcolor: 'rgba(0, 229, 153, 0.1)',
                                        '&:hover': {
                                            bgcolor: 'rgba(0, 229, 153, 0.2)',
                                        }
                                    },
                                    '&:hover': {
                                        bgcolor: '#1a1a1a'
                                    }
                                }}
                            >
                                <ListItemIcon sx={{
                                    color: isActive ? '#00e599' : '#a0a0a0',
                                    minWidth: 40
                                }}>
                                    {React.cloneElement(item.icon, { fontSize: 'small' })}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                        fontSize: '0.875rem',
                                        fontWeight: isActive ? 600 : 500,
                                        color: isActive ? '#fff' : '#a0a0a0'
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
