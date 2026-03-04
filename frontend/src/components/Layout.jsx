import React from 'react';
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const [mobileOpen, setMobileOpen] = React.useState(false);

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#ffffff' }}>
            <Sidebar
                isCollapsed={isCollapsed}
                onToggle={() => setIsCollapsed(!isCollapsed)}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />
            <Box sx={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0 // Prevent content from overflowing
            }}>
                {isMobile && (
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', borderBottom: '1px solid #eef0f2' }}>
                        <IconButton onClick={() => setMobileOpen(true)} size="small">
                            <MenuIcon />
                        </IconButton>
                    </Box>
                )}
                <Outlet />
            </Box>
        </Box>
    );
};

export default Layout;
