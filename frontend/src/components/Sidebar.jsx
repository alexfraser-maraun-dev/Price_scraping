import React, { useState } from 'react';
import {
  Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  IconButton, Tooltip, Drawer, useMediaQuery, useTheme,
  Avatar, Typography, Divider, Collapse
} from '@mui/material';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import BarChartIcon from '@mui/icons-material/BarChart';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import LogoutIcon from '@mui/icons-material/Logout';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PercentIcon from '@mui/icons-material/Percent';
import SpeedIcon from '@mui/icons-material/Speed';
import SnailIcon from '@mui/icons-material/HourglassBottom';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';

import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import Logo from './Logo';

// Maps backend bucket key → display label + icon
export const BUCKET_ITEMS = [
  { key: 'all',                            label: 'All Products',              icon: <AllInclusiveIcon /> },
  { key: 'top_200_weekly_volume',           label: 'Top Volume (Weekly)',       icon: <ShoppingCartIcon /> },
  { key: 'top_200_weekly_revenue',          label: 'Top Revenue (Weekly)',      icon: <AttachMoneyIcon /> },
  { key: 'top_200_gmroi_30d_high',          label: 'Top GMROI (30d)',           icon: <TrendingUpIcon /> },
  { key: 'bottom_200_gmroi_30d_profitable', label: 'Bottom GMROI (30d)',        icon: <TrendingDownIcon /> },
  { key: 'top_200_highest_margin_weekly',   label: 'Highest Margin (Weekly)',   icon: <PercentIcon /> },
  { key: 'top_200_lowest_margin_weekly',    label: 'Lowest Margin (Weekly)',    icon: <PercentIcon /> },
  { key: 'top_200_sellthrough_30d_high',    label: 'Top Sellthrough (30d)',     icon: <SpeedIcon /> },
  { key: 'bottom_200_sellthrough_30d_low',  label: 'Low Sellthrough (30d)',     icon: <SnailIcon /> },
  { key: 'search_result',                   label: 'Search Results',            icon: <SearchIcon /> },
];

const Sidebar = ({ isCollapsed, onToggle, mobileOpen, onMobileClose, activeBucket, onBucketChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Keep Products expanded if we're on the products route
  const onProductsPage = location.pathname === '/';
  const [productsOpen, setProductsOpen] = useState(true);

  const showText = !isCollapsed || isMobile;

  const subItemSx = (isActive) => ({
    borderRadius: '8px',
    py: 0.75,
    pl: showText ? 4.5 : 0,
    pr: showText ? 2 : 0,
    justifyContent: !showText ? 'center' : 'initial',
    bgcolor: isActive ? 'rgba(0, 123, 94, 0.10)' : 'transparent',
    color: isActive ? '#007b5e' : '#5f6368',
    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
  });

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
      {/* Logo + collapse toggle */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: (isCollapsed && !isMobile) ? 'center' : 'space-between',
        mb: 3, mt: 1, minHeight: 40
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

      <List sx={{ mt: 0, p: 0 }}>
        {/* ── Products (expandable) ── */}
        <ListItem disablePadding sx={{ mb: 0.25, display: 'block' }}>
          {!showText ? (
            <Tooltip title="Products" placement="right">
              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <ListItemButton
                  onClick={() => { navigate('/'); if (isMobile) onMobileClose(); }}
                  sx={{
                    borderRadius: '10px', py: 1.25, px: 0,
                    justifyContent: 'center',
                    bgcolor: onProductsPage ? 'rgba(0, 123, 94, 0.08)' : 'transparent',
                    color: onProductsPage ? '#007b5e' : '#5f6368',
                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
                    <Inventory2Icon fontSize="small" />
                  </ListItemIcon>
                </ListItemButton>
              </Box>
            </Tooltip>
          ) : (
            <ListItemButton
              onClick={() => {
                if (!onProductsPage) { navigate('/'); }
                setProductsOpen(o => !o);
              }}
              sx={{
                borderRadius: '10px', py: 1.25, px: 2,
                bgcolor: onProductsPage && !productsOpen ? 'rgba(0, 123, 94, 0.08)' : 'transparent',
                color: onProductsPage ? '#007b5e' : '#5f6368',
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 40, display: 'flex', justifyContent: 'center' }}>
                <Inventory2Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Products"
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600, noWrap: true }}
              />
              {productsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </ListItemButton>
          )}
        </ListItem>

        {/* Sub-items */}
        {showText && (
          <Collapse in={productsOpen} timeout="auto" unmountOnExit>
            <List disablePadding>
              {BUCKET_ITEMS.map(({ key, label, icon }) => {
                const isActive = onProductsPage && activeBucket === key;
                return (
                  <ListItem key={key} disablePadding sx={{ mb: 0.25 }}>
                    <ListItemButton
                      onClick={() => {
                        navigate('/');
                        onBucketChange(key);
                        if (isMobile) onMobileClose();
                      }}
                      sx={subItemSx(isActive)}
                    >
                      <ListItemIcon sx={{ color: isActive ? '#007b5e' : '#9aa0a6', minWidth: 32, display: 'flex', justifyContent: 'center' }}>
                        {React.cloneElement(icon, { fontSize: 'small', sx: { fontSize: '0.95rem' } })}
                      </ListItemIcon>
                      <ListItemText
                        primary={label}
                        primaryTypographyProps={{
                          fontSize: '0.78rem',
                          fontWeight: isActive ? 700 : 500,
                          noWrap: true,
                          color: isActive ? '#007b5e' : '#5f6368',
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Collapse>
        )}

        <Divider sx={{ borderColor: '#eef0f2', my: 1 }} />

        {/* ── Reports ── */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          {!showText ? (
            <Tooltip title="Reports" placement="right">
              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <ListItemButton
                  onClick={() => { navigate('/reports'); if (isMobile) onMobileClose(); }}
                  sx={{
                    borderRadius: '10px', py: 1.25, px: 0, justifyContent: 'center',
                    bgcolor: location.pathname === '/reports' ? 'rgba(0, 123, 94, 0.08)' : 'transparent',
                    color: location.pathname === '/reports' ? '#007b5e' : '#5f6368',
                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
                    <BarChartIcon fontSize="small" />
                  </ListItemIcon>
                </ListItemButton>
              </Box>
            </Tooltip>
          ) : (
            <ListItemButton
              onClick={() => { navigate('/reports'); if (isMobile) onMobileClose(); }}
              sx={{
                borderRadius: '10px', py: 1.25, px: 2,
                bgcolor: location.pathname === '/reports' ? 'rgba(0, 123, 94, 0.08)' : 'transparent',
                color: location.pathname === '/reports' ? '#007b5e' : '#5f6368',
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === '/reports' ? '#007b5e' : '#5f6368', minWidth: 40, display: 'flex', justifyContent: 'center' }}>
                <BarChartIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Reports"
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: location.pathname === '/reports' ? 700 : 500, noWrap: true }}
              />
            </ListItemButton>
          )}
        </ListItem>
      </List>

      <Box flexGrow={1} />
      <Divider sx={{ borderColor: '#eef0f2', mx: -1.5, mb: 1.5 }} />

      {/* User + Logout */}
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
            borderRadius: '10px', py: 1,
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
          sx={{ '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240, borderRight: '1px solid #eef0f2' } }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Box
          component="nav"
          sx={{ width: isCollapsed ? 72 : 240, flexShrink: 0, transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                width: isCollapsed ? 72 : 240,
                transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxSizing: 'border-box',
                borderRight: '1px solid #eef0f2',
                overflowX: 'hidden',
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
