import React from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, IconButton, Tooltip, Drawer, useMediaQuery, useTheme, Avatar, Typography, Divider } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BarChartIcon from '@mui/icons-material/BarChart';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import LogoutIcon from '@mui/icons-material/Logout';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

import Logo from './Logo';

const navItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard_placeholder' },
    { text: 'Products', icon: <Inventory2Icon />, path: '/' },
    { text: 'Dynamic Pricing', icon: <TrendingUpIcon />, path: '/pricing_placeholder' },
    { text: 'Reports', icon: <BarChartIcon />, path: '/reports' },
];

const Sidebar = ({ isCollapsed, onToggle, mobileOpen, onMobileClose }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const drawerContent = (
        <Box sx={{
            width: isCollapsed && !isMobile ? 72 : 240,
            transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            p: 1.5,
            overflowX: 'hidden',
        }}>
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: (isCollapsed && !isMobile) ? 'center' : 'space-between',
                mb: 3,
                mt: 1,
                minHeight: 40
            }}>
                {(!isCollapsed || isMobile) && (
                    <Box sx={{ overflow: 'hidden', flexShrink: 1, mr: 1 }}>
                        <Logo />
                    </Box>
                )}
                {!isMobile && (
                    <IconButton
                        onClick={onToggle}
                        size="small"
                        sx={{
                            color: '#5f6368',
                            bgcolor: 'rgba(0,0,0,0.02)',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
                        }}
                    >
                        {isCollapsed ? <MenuIcon /> : <ChevronLeftIcon />}
                    </IconButton>
                )}
            </Box>

            <List sx={{ mt: 0 }}>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const showText = !isCollapsed || isMobile;

                    const content = (
                        <ListItemButton
                            onClick={() => {
                                navigate(item.path);
                                if (isMobile) onMobileClose();
                            }}
                            sx={{
                                borderRadius: '10px',
                                py: 1.25,
                                px: !showText ? 0 : 2,
                                justifyContent: !showText ? 'center' : 'initial',
                                bgcolor: isActive ? 'rgba(0, 123, 94, 0.08)' : 'transparent',
                                color: isActive ? '#007b5e' : '#5f6368',
                                '&:hover': {
                                    bgcolor: 'rgba(0, 0, 0, 0.04)'
                                }
                            }}
                        >
                            <ListItemIcon sx={{
                                color: isActive ? '#007b5e' : '#5f6368',
                                minWidth: !showText ? 0 : 40,
                                display: 'flex',
                                justifyContent: 'center'
                            }}>
                                {React.cloneElement(item.icon, { fontSize: 'small' })}
                            </ListItemIcon>
                            {showText && (
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                        fontSize: '0.875rem',
                                        fontWeight: isActive ? 700 : 500,
                                        noWrap: true
                                    }}
                                />
                            )}
                        </ListItemButton>
                    );

                    return (
                        <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                            {!showText ? (
                                <Tooltip title={item.text} placement="right">
                                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                        {content}
                                    </Box>
                                </Tooltip>
                            ) : content}
                        </ListItem>
                    );
                })}
            </List>

            <Box flexGrow={1} />
            <Divider sx={{ borderColor: '#eef0f2', mx: -1.5, mb: 1.5 }} />

            <Box sx={{ p: 0.5 }}>
                {user && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1, px: isCollapsed ? 0 : 1, justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.8rem', fontWeight: 700 }}>
                            {user.name ? user.name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                        </Avatar>
                        {!isCollapsed && !isMobile && (
                            <Box sx={{ overflow: 'hidden' }}>
                                <Typography variant="subtitle2" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                    {user.name || 'User'}
                                </Typography>
                                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#5f6368', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'block' }}>
                                    {user.email}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}
                <ListItemButton
                    onClick={logout}
                    sx={{
                        borderRadius: '10px',
                        py: 1,
                        px: isCollapsed ? 0 : 1,
                        justifyContent: isCollapsed ? 'center' : 'initial',
                        color: theme.palette.error.main,
                        '&:hover': { bgcolor: 'rgba(220, 53, 69, 0.08)' }
                    }}
                >
                    <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, color: 'inherit', display: 'flex', justifyContent: 'center' }}>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    {(!isCollapsed || isMobile) && (
                        <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }} />
                    )}
                </ListItemButton>
            </Box>
        </Box>
    );

    return (
        <>
            {isMobile ? (
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={onMobileClose}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240, borderRight: '1px solid #eef0f2' },
                    }}
                >
                    {drawerContent}
                </Drawer>
            ) : (
                <Box
                    component="nav"
                    sx={{
                        width: isCollapsed ? 72 : 240,
                        flexShrink: 0,
                        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                >
                    <Drawer
                        variant="permanent"
                        sx={{
                            '& .MuiDrawer-paper': {
                                width: isCollapsed ? 72 : 240,
                                transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxSizing: 'border-box',
                                borderRight: '1px solid #eef0f2',
                                overflowX: 'hidden'
                            },
                        }}
                        open
                    >
                        {drawerContent}
                    </Drawer>
                </Box>
            )}
        </>
    );
};

export default Sidebar;
