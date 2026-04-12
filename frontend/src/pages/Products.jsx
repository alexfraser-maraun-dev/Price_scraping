import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Container, Typography, Box, Paper, CircularProgress, LinearProgress,
  Alert, Button, TextField, Chip, Checkbox, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
  MenuItem, Select, FormControl, InputLabel, Divider, Grid, Avatar,
  Autocomplete, Switch, FormControlLabel
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TimelineIcon from '@mui/icons-material/Timeline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import TuneIcon from '@mui/icons-material/Tune';
import NorthIcon from '@mui/icons-material/North';
import SouthIcon from '@mui/icons-material/South';
import StyleIcon from '@mui/icons-material/Style';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import axios from 'axios';
import Logo from '../components/Logo';

// --- Mock Data ---
const mockData = [
  {
    system_sku: "ELE-30451", custom_sku: "SHI-RD-8150", upc: "123456789012",
    product_name: "14 AWG THHN Wire, Solid, 500ft, Black",
    our_price: 89.00, total_revenue: 12500.50,
    brand_name: "Shimano", category_main: "Electrical",
    subcategory_1: "Drivetrain", subcategory_2: "Derailleurs",
    competitors: [
      { business_name: "Google Benchmark", url: "", price: 92.40, price_diff_pct: 3.8 }
    ]
  },
  {
    system_sku: "ELE-30599", custom_sku: "SRA-CH-12", upc: "223456789012",
    product_name: "LED Panel Light, 2x4, 50W, 5000K, DLC",
    our_price: 54.00, total_revenue: 8400.20,
    brand_name: "SRAM", category_main: "Electrical",
    subcategory_1: "Lighting", subcategory_2: "Panels",
    competitors: [
      { business_name: "Google Benchmark", url: "", price: 58.50, price_diff_pct: 8.3 }
    ]
  },
  {
    system_sku: "FAS-10032", custom_sku: "SHI-BP-RES", upc: "323456789012",
    product_name: "Hex Bolt M10x50 Grade 8.8 Zinc (Box/100)",
    our_price: 42.50, total_revenue: 4200.00,
    brand_name: "Shimano", category_main: "Fasteners",
    subcategory_1: "Brakes", subcategory_2: "Brake Pads",
    competitors: [
      { business_name: "Google Benchmark", url: "", price: 45.99, price_diff_pct: 8.2 }
    ]
  }
];

const Products = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Pricing rule state
  const [pricingRule, setPricingRule] = useState('none');
  const [pctChange, setPctChange] = useState('');
  const [dollarChange, setDollarChange] = useState('');

  // Sort/Filter state
  const [sortField, setSortField] = useState('upc');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcat1, setFilterSubcat1] = useState('');
  const [filterSubcat2, setFilterSubcat2] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [showOnlyBenchmarked, setShowOnlyBenchmarked] = useState(false);

  const handleRequestSort = (property) => {
    const isAsc = sortField === property && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortField(property);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.get(`${baseUrl}/api/products`);
      setProducts(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      const msg = err.response?.data?.detail || err.message;
      setError(`API Error (${err.response?.status || 'Network'}): ${msg}. Showing mock data for UI testing.`);
      setProducts(mockData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) return;

        const parseCsvLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' && line[i + 1] === '"') {
              current += '"';
              i++;
            } else if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
        const requiredHeaders = [
          'brand_name', 'product_name', 'category_main',
          'subcategory_1', 'subcategory_2', 'custom_sku',
          'total_revenue', 'current_default_price', 'upc', 'current_cost', 'prospective_margin_pct'
        ];

        const missing = requiredHeaders.filter(h => !headers.includes(h));
        if (missing.length > 0) {
          setError(`Missing required CSV headers: ${missing.join(', ')}`);
          return;
        }

        const parsed = lines.slice(1).map(line => {
          const vals = parseCsvLine(line);
          const row = {};
          headers.forEach((h, i) => { row[h] = vals[i] || ''; });

          return {
            system_sku: row['custom_sku'], // Using custom_sku as the primary identifier per request
            custom_sku: row['custom_sku'],
            upc: row['upc'],
            product_name: row['product_name'],
            our_price: parseFloat(row['current_default_price'] || 0),
            brand_name: row['brand_name'],
            category_main: row['category_main'],
            subcategory_1: row['subcategory_1'],
            subcategory_2: row['subcategory_2'],
            total_revenue: parseFloat(row['total_revenue'] || 0),
            current_cost: parseFloat(row['current_cost'] || 0),
            prospective_margin_pct: parseFloat(row['prospective_margin_pct'] || 0),
            competitors: []
          };
        }).filter(p => p.custom_sku || p.upc);

        setProducts(parsed);
        setError(null);
      } catch (err) {
        setError('Failed to parse CSV. Please ensure the file is correctly formatted.');
      }
    };
    reader.readAsText(file);
  };

  const handleScrape = async () => {
    setIsScraping(true);
    setScrapeProgress(10); // Start progress

    try {
      // Re-fetch products from the backend (which hits the Merchant API)
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.get(`${baseUrl}/api/products`);
      setProducts(response.data);
      setScrapeProgress(100);
      setError(null);
    } catch (err) {
      console.error('Failed to run scrape:', err);
      const msg = err.response?.data?.detail || err.message;
      setError(`Scrape failed (${err.response?.status || 'Network'}): ${msg}`);
    } finally {
      setTimeout(() => {
        setIsScraping(false);
        setScrapeProgress(0);
      }, 1000); // Briefly show 100% completion
    }
  };

  const handleExportCSV = () => {
    const csvContent = "system_sku,our_price\n" + products.map(p => `${p.system_sku},${p.our_price}`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'export.csv';
    link.click();
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = filteredProducts.map((n) => n.upc || n.system_sku);
      setSelectedRows(new Set(newSelecteds));
      return;
    }
    setSelectedRows(new Set());
  };

  const handleClick = (event, id) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const filterOptions = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category_main).filter(Boolean))].sort();
    const sub1s = [...new Set(products.map(p => p.subcategory_1).filter(Boolean))].sort();
    const sub2s = [...new Set(products.map(p => p.subcategory_2).filter(Boolean))].sort();
    const brands = [...new Set(products.map(p => p.brand_name).filter(Boolean))].sort();
    return { cats, sub1s, sub2s, brands };
  }, [products]);

  const getAvgCompPrice = (p) => {
    const compPrices = p.competitors?.map(c => c.price).filter(Boolean) || [];
    return compPrices.length > 0 ? compPrices.reduce((a, b) => a + b, 0) / compPrices.length : null;
  };

  const isBelowMarket = (p) => {
    const avg = getAvgCompPrice(p);
    return avg !== null && p.our_price < avg;
  };

  const isAboveMarket = (p) => {
    const avg = getAvgCompPrice(p);
    return avg !== null && p.our_price > avg;
  };



  const getSuggestedPrice = (product) => {
    const compPrices = product.competitors?.map(c => c.price).filter(Boolean) || [];
    if (compPrices.length === 0) return null;
    const lowestComp = Math.min(...compPrices);
    const avgComp = compPrices.reduce((a, b) => a + b, 0) / compPrices.length;
    const highestComp = Math.max(...compPrices);
    let basePrice = product.our_price;
    switch (pricingRule) {
      case 'match_lowest': basePrice = lowestComp; break;
      case 'undercut_lowest': basePrice = lowestComp * 0.99; break;
      case 'match_average': basePrice = avgComp; break;
      case 'beat_average': basePrice = avgComp * 1.02; break;
      case 'match_highest': basePrice = highestComp; break;
      default: basePrice = product.our_price;
    }
    if (pctChange && !isNaN(parseFloat(pctChange))) basePrice *= (1 + parseFloat(pctChange) / 100);
    if (dollarChange && !isNaN(parseFloat(dollarChange))) basePrice += parseFloat(dollarChange);
    return Math.max(0, parseFloat(basePrice.toFixed(2)));
  };

  const hasPricingRule = pricingRule !== 'none' || pctChange || dollarChange;

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = !search ||
        p.product_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.upc?.toLowerCase().includes(search.toLowerCase());
      const matchesCat = !filterCategory || p.category_main === filterCategory;
      const matchesSub1 = !filterSubcat1 || p.subcategory_1 === filterSubcat1;
      const matchesSub2 = !filterSubcat2 || p.subcategory_2 === filterSubcat2;
      const matchesBrand = !filterBrand || p.brand_name === filterBrand;
      const matchesMarket = !marketFilter || (marketFilter === 'below' && isBelowMarket(p)) || (marketFilter === 'above' && isAboveMarket(p));
      const matchesBenchmark = !showOnlyBenchmarked || p.competitors?.some(c => c.business_name === 'Google Benchmark');

      return matchesSearch && matchesCat && matchesSub1 && matchesSub2 && matchesBrand && matchesMarket && matchesBenchmark;
    });

    return result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle numeric fields
      if (['our_price', 'prospective_margin_pct', 'total_revenue'].includes(sortField)) {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Default string comparison
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [products, search, filterCategory, filterSubcat1, filterSubcat2, filterBrand, marketFilter, showOnlyBenchmarked, sortField, sortDirection]);

  const getCategoryColor = (cat) => {
    const colors = {
      'Electrical': { bg: '#e6f4ea', text: '#1e7e34' },
      'Fasteners': { bg: '#e8f0fe', text: '#1a73e8' },
      'Janitorial': { bg: '#f1f3f4', text: '#5f6368' },
      'Packaging': { bg: '#feefe3', text: '#e67c73' },
      'Plumbing': { bg: '#f3e8fd', text: '#9334e6' },
      'Safety Equipment': { bg: '#fce8e6', text: '#d93025' },
      'Tools': { bg: '#fff7e0', text: '#f29900' }
    };
    return colors[cat] || { bg: '#f1f3f4', text: '#5f6368' };
  };

  // When rows are selected, all metric tiles scope to the selection; otherwise fall back to filteredProducts
  const activeProducts = useMemo(() => {
    if (selectedRows.size === 0) return filteredProducts;
    return filteredProducts.filter(p => selectedRows.has(p.upc || p.system_sku));
  }, [filteredProducts, selectedRows]);

  const isSelectionMode = selectedRows.size > 0;

  // Unified market-position evaluator for a given price function
  const computeMarketMetrics = useCallback((products, getPriceFn) => {
    let belowCnt = 0, aboveCnt = 0;
    let dollarBelow = 0, dollarAbove = 0;
    let totalBelowBase = 0, totalBelowDiff = 0;
    let totalAboveBase = 0, totalAboveDiff = 0;
    products.forEach(p => {
      const price = getPriceFn(p);
      const avg = getAvgCompPrice(p);
      if (avg === null) return;
      if (price < avg) {
        // Our price is BELOW market — we are competitive
        belowCnt++;
        dollarBelow += (avg - price);
        totalBelowBase += avg;
        totalBelowDiff += (avg - price);
      } else if (price > avg) {
        // Our price is ABOVE market — we are overpriced
        aboveCnt++;
        dollarAbove += (price - avg);
        totalAboveBase += price;
        totalAboveDiff += (price - avg);
      }
    });
    return {
      belowCount: belowCnt,
      aboveCount: aboveCnt,
      dollarBelow,
      pctBelow: totalBelowBase > 0 ? (totalBelowDiff / totalBelowBase * 100) : 0,
      dollarAbove,
      pctAbove: totalAboveBase > 0 ? (totalAboveDiff / totalAboveBase * 100) : 0,
    };
  }, [getAvgCompPrice]);

  // Baseline = current prices (no rule applied)
  const baselineMetrics = useMemo(() =>
    computeMarketMetrics(activeProducts, p => p.our_price),
    [activeProducts, computeMarketMetrics]);

  // Proposed = rule-adjusted prices
  const proposedMetrics = useMemo(() =>
    computeMarketMetrics(activeProducts, p =>
      hasPricingRule ? (getSuggestedPrice(p) ?? p.our_price) : p.our_price
    ),
    [activeProducts, computeMarketMetrics, hasPricingRule, pricingRule, pctChange, dollarChange]);

  // Live displayed values (proposed when rule active, baseline otherwise)
  const liveMetrics = hasPricingRule ? proposedMetrics : baselineMetrics;

  const avgMargin = useMemo(() => {
    const margins = activeProducts.map(p => p.prospective_margin_pct).filter(m => m !== undefined && m !== null);
    return margins.length > 0 ? (margins.reduce((a, b) => a + b, 0) / margins.length).toFixed(1) : '—';
  }, [activeProducts]);

  const proposedMargin = useMemo(() => {
    const margins = activeProducts.map(p => {
      const suggested = (hasPricingRule && getSuggestedPrice(p) !== null) ? getSuggestedPrice(p) : p.our_price;
      if (!suggested || !p.current_cost) return p.prospective_margin_pct;
      return ((suggested - p.current_cost) / suggested) * 100;
    }).filter(m => m !== undefined && m !== null);
    return margins.length > 0 ? (margins.reduce((a, b) => a + b, 0) / margins.length).toFixed(1) : '—';
  }, [activeProducts, hasPricingRule, pricingRule, pctChange, dollarChange]);

  // Compact delta badge — only renders when a pricing rule is active
  const DeltaBadge = ({ current, baseline, fmt, positiveIsGood = true }) => {
    if (!hasPricingRule) return null;
    if (isNaN(current) || isNaN(baseline)) return null;
    const delta = current - baseline;
    if (Math.abs(delta) < 0.001) return null;
    const isImprovement = positiveIsGood ? delta > 0 : delta < 0;
    const sign = delta > 0 ? '+' : '';
    return (
      <Box component="span" sx={{ ml: 0.75, fontSize: '0.64rem', fontWeight: 800, color: isImprovement ? '#28a745' : '#dc3545', whiteSpace: 'nowrap', bgcolor: isImprovement ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)', px: 0.6, py: 0.1, borderRadius: '4px' }}>
        {sign}{fmt(delta)}
      </Box>
    );
  };

  const ruleOptions = [
    { value: 'none', label: 'No Rule' },
    { value: 'match_lowest', label: 'Match Benchmark' },
    { value: 'undercut_lowest', label: 'Undercut Benchmark by 1%' },
    { value: 'beat_average', label: 'Beat Benchmark by 2%' },
  ];

  if (loading && products.length === 0) {
    return <Box display="flex" justifyContent="center" alignItems="center" height="100vh"><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 4, pt: 3, maxWidth: '1600px', margin: '0 auto', bgcolor: '#ffffff', minHeight: '100vh' }}>
      {/* Header Section */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.02em', mr: 2 }}>
            Products
          </Typography>
          <Chip
            label={`${filteredProducts.length} UPCs`}
            sx={{ bgcolor: '#f1f3f5', fontWeight: 600, color: '#1a1a1a', borderRadius: '8px' }}
          />
          {isSelectionMode && (
            <Chip
              label={`${selectedRows.size} selected`}
              size="small"
              sx={{ bgcolor: '#e8f0fe', fontWeight: 600, color: '#1a73e8', borderRadius: '8px' }}
            />
          )}
          <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.6, ml: 1 }}>
            Last scrape: Today, 08:30 AM
          </Typography>
        </Box>

        <Box display="flex" gap={1.5}>
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVUpload} style={{ display: 'none' }} />
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            sx={{ color: 'text.primary', borderColor: '#eef0f2' }}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload CSV
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCSV} sx={{ color: 'text.primary', borderColor: '#eef0f2' }}>
            Export CSV
          </Button>
          <Button
            variant="contained"
            startIcon={isScraping ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
            onClick={handleScrape}
            disabled={isScraping}
            sx={{
              bgcolor: '#007b5e',
              borderRadius: '8px',
              textTransform: 'none',
              px: 3,
              '&:hover': { bgcolor: '#00634b' }
            }}
          >
            {isScraping ? 'Scraping...' : 'Run Scrape'}
          </Button>
        </Box>
      </Box>

      {isScraping && (
        <Box sx={{ width: '100%', mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={scrapeProgress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(0, 123, 94, 0.1)',
              '& .MuiLinearProgress-bar': { bgcolor: '#007b5e', borderRadius: 4 }
            }}
          />
          <Typography variant="caption" sx={{ color: '#007b5e', fontWeight: 600, mt: 0.5, display: 'block' }}>
            Scraping competitive data... {scrapeProgress}%
          </Typography>
        </Box>
      )}

      {/* Search & Filter Row */}
      <Box display="flex" flexDirection="column" gap={2} mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
          <Box display="flex" flexGrow={1} gap={2} flexWrap="wrap">
            <TextField
              size="small"
              placeholder="Search UPC or product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: '300px', '& .MuiOutlinedInput-root': { bgcolor: '#f8f9fa', '& fieldset': { border: 'none' }, borderRadius: '10px' } }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: '#5f6368', mr: 1, fontSize: 20 }} />
              }}
            />
            <Autocomplete
              size="small"
              options={filterOptions.cats}
              value={filterCategory || null}
              onChange={(e, newValue) => setFilterCategory(newValue || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="All Categories"
                  sx={{ width: '200px', '& .MuiOutlinedInput-root': { bgcolor: '#f8f9fa', '& fieldset': { border: 'none' }, borderRadius: '10px' } }}
                />
              )}
            />
            <Autocomplete
              size="small"
              options={filterOptions.brands}
              value={filterBrand || null}
              onChange={(e, newValue) => setFilterBrand(newValue || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="All Brands"
                  sx={{ width: '200px', '& .MuiOutlinedInput-root': { bgcolor: '#f8f9fa', '& fieldset': { border: 'none' }, borderRadius: '10px' } }}
                />
              )}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showOnlyBenchmarked}
                  onChange={(e) => setShowOnlyBenchmarked(e.target.checked)}
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#1a73e8' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#1a73e8' } }}
                />
              }
              label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Benchmarked Only</Typography>}
            />
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => { setSearch(''); setFilterCategory(''); setFilterBrand(''); setMarketFilter(''); setShowOnlyBenchmarked(false); }}>
              <TuneIcon sx={{ color: '#5f6368' }} />
            </IconButton>
          </Box>
        </Box>

        {/* Pricing Strategy Row */}
        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#fcfcfc', border: '1px solid #eef0f2', borderRadius: '12px' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', minWidth: 140 }}>
            Pricing Strategy
          </Typography>
          <TextField select size="small" value={pricingRule} onChange={(e) => setPricingRule(e.target.value)} SelectProps={{ native: true }} sx={{ minWidth: 200 }}>
            {ruleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </TextField>
          <TextField placeholder="change" size="small" type="number" value={pctChange} onChange={(e) => setPctChange(e.target.value)} sx={{ width: 120 }} InputProps={{ endAdornment: '%' }} inputProps={{ style: { textAlign: 'right' } }} />
          <TextField placeholder="change" size="small" type="number" value={dollarChange} onChange={(e) => setDollarChange(e.target.value)} sx={{ width: 120 }} InputProps={{ startAdornment: '$' }} inputProps={{ style: { textAlign: 'right' } }} />
          {(pricingRule !== 'none' || pctChange || dollarChange) && (
            <Button size="small" variant="text" color="inherit" onClick={() => { setPricingRule('none'); setPctChange(''); setDollarChange(''); }}>Clear</Button>
          )}
        </Paper>
      </Box>

      {/* Stats Overview Grid — always 2 rows of 4, banner anchored below */}
      <Grid container spacing={2} mb={0}>
        {/* Row 1 */}
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fcfcfc', border: '1px solid #eef0f2', borderRadius: '12px' }}>
            <Avatar sx={{ bgcolor: 'rgba(0, 123, 94, 0.08)', color: '#007b5e', width: 34, height: 34 }}><AttachMoneyIcon fontSize="small" /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>Average Margin</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{avgMargin}%</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: hasPricingRule ? '#f0f4ff' : '#fcfcfc', border: hasPricingRule ? '1px solid #1a73e8' : '1px solid #eef0f2', borderRadius: '12px' }}>
            <Avatar sx={{ bgcolor: hasPricingRule ? 'rgba(26,115,232,0.08)' : 'rgba(0,123,94,0.08)', color: hasPricingRule ? '#1a73e8' : '#007b5e', width: 34, height: 34 }}><AttachMoneyIcon fontSize="small" /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>Proposed Margin</Typography>
              <Box display="flex" alignItems="baseline">
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: hasPricingRule ? '#1a73e8' : 'inherit' }}>{proposedMargin}%</Typography>
                <DeltaBadge current={parseFloat(proposedMargin)} baseline={parseFloat(avgMargin)} fmt={v => `${v > 0 ? '+' : ''}${Math.abs(v).toFixed(1)}%`} positiveIsGood={true} />
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper onClick={() => setMarketFilter(marketFilter === 'below' ? '' : 'below')}
            sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fcfcfc', border: marketFilter === 'below' ? `2px solid ${theme.palette.success.main}` : '1px solid #eef0f2', borderRadius: '12px', cursor: 'pointer' }}>
            <Avatar sx={{ bgcolor: 'rgba(40,167,69,0.08)', color: '#28a745', width: 34, height: 34 }}><TrendingDownIcon fontSize="small" /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>Below Market</Typography>
              <Box display="flex" alignItems="baseline" gap={0.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{liveMetrics.belowCount}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>UPCs</Typography>
                <DeltaBadge current={liveMetrics.belowCount} baseline={baselineMetrics.belowCount} fmt={v => (v > 0 ? '+' : '') + Math.round(v)} positiveIsGood={true} />
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper onClick={() => setMarketFilter(marketFilter === 'above' ? '' : 'above')}
            sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fcfcfc', border: marketFilter === 'above' ? `2px solid ${theme.palette.error.main}` : '1px solid #eef0f2', borderRadius: '12px', cursor: 'pointer' }}>
            <Avatar sx={{ bgcolor: 'rgba(220,53,69,0.08)', color: '#dc3545', width: 34, height: 34 }}><TrendingUpIcon fontSize="small" /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>Above Market</Typography>
              <Box display="flex" alignItems="baseline" gap={0.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{liveMetrics.aboveCount}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>UPCs</Typography>
                <DeltaBadge current={liveMetrics.aboveCount} baseline={baselineMetrics.aboveCount} fmt={v => (v > 0 ? '+' : '') + Math.round(v)} positiveIsGood={false} />
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Row 2 */}
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fcfcfc', border: '1px solid #eef0f2', borderRadius: '12px' }}>
            <Avatar sx={{ bgcolor: 'rgba(40,167,69,0.08)', color: '#28a745', width: 34, height: 34 }}><TrendingDownIcon fontSize="small" /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>$ Below Market</Typography>
              <Box display="flex" alignItems="baseline">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>${liveMetrics.dollarBelow.toFixed(2)}</Typography>
                <DeltaBadge current={liveMetrics.dollarBelow} baseline={baselineMetrics.dollarBelow} fmt={v => `${v > 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`} positiveIsGood={true} />
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fcfcfc', border: '1px solid #eef0f2', borderRadius: '12px' }}>
            <Avatar sx={{ bgcolor: 'rgba(40,167,69,0.08)', color: '#28a745', width: 34, height: 34 }}><TrendingDownIcon fontSize="small" /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>% Below Market</Typography>
              <Box display="flex" alignItems="baseline">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{liveMetrics.pctBelow.toFixed(1)}%</Typography>
                <DeltaBadge current={liveMetrics.pctBelow} baseline={baselineMetrics.pctBelow} fmt={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`} positiveIsGood={true} />
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fcfcfc', border: '1px solid #eef0f2', borderRadius: '12px' }}>
            <Avatar sx={{ bgcolor: 'rgba(220,53,69,0.08)', color: '#dc3545', width: 34, height: 34 }}><TrendingUpIcon fontSize="small" /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>$ Above Market</Typography>
              <Box display="flex" alignItems="baseline">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>${liveMetrics.dollarAbove.toFixed(2)}</Typography>
                <DeltaBadge current={liveMetrics.dollarAbove} baseline={baselineMetrics.dollarAbove} fmt={v => `${v > 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`} positiveIsGood={false} />
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fcfcfc', border: '1px solid #eef0f2', borderRadius: '12px' }}>
            <Avatar sx={{ bgcolor: 'rgba(220,53,69,0.08)', color: '#dc3545', width: 34, height: 34 }}><TrendingUpIcon fontSize="small" /></Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>% Above Market</Typography>
              <Box display="flex" alignItems="baseline">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{liveMetrics.pctAbove.toFixed(1)}%</Typography>
                <DeltaBadge current={liveMetrics.pctAbove} baseline={baselineMetrics.pctAbove} fmt={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`} positiveIsGood={false} />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Selection mode banner container — fixed height to prevent vertical jump */}
      <Box sx={{ minHeight: '48px', mt: 1.5, mb: 1.5 }}>
        {isSelectionMode && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: '#e8f0fe', borderRadius: '10px', border: '1px solid #c5d8fb', animation: 'fadeIn 0.2s ease-in-out' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#1a73e8', fontSize: '0.65rem', letterSpacing: '0.5px' }}>SELECTION MODE</Typography>
            <Typography variant="caption" sx={{ color: '#1a73e8', fontSize: '0.65rem' }}>— tiles reflect {selectedRows.size} selected row{selectedRows.size !== 1 ? 's' : ''}</Typography>
            <Box flexGrow={1} />
            <Button size="small" variant="text" sx={{ color: '#1a73e8', fontSize: '0.65rem', py: 0, minWidth: 0, fontWeight: 700, '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }} onClick={() => setSelectedRows(new Set())}>Clear selection</Button>
          </Box>
        )}
      </Box>

      {/* Main Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #eef0f2', borderRadius: '12px' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ bgcolor: '#f8f9fa' }}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Checkbox
                    size="small"
                    indeterminate={selectedRows.size > 0 && selectedRows.size < filteredProducts.length}
                    checked={filteredProducts.length > 0 && selectedRows.size === filteredProducts.length}
                    onChange={handleSelectAllClick}
                  />
                  {selectedRows.size > 0 && (
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#1a73e8', fontSize: '0.65rem', lineHeight: 1 }}>
                      {selectedRows.size}
                    </Typography>
                  )}
                </Box>
              </TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 700, fontSize: '0.7rem', color: '#5f6368', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                <TableSortLabel
                  active={sortField === 'upc'}
                  direction={sortField === 'upc' ? sortDirection : 'asc'}
                  onClick={() => handleRequestSort('upc')}
                >
                  UPC
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 700, fontSize: '0.7rem', color: '#5f6368', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                <TableSortLabel
                  active={sortField === 'product_name'}
                  direction={sortField === 'product_name' ? sortDirection : 'asc'}
                  onClick={() => handleRequestSort('product_name')}
                >
                  Product
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 700, fontSize: '0.7rem', color: '#5f6368', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                <TableSortLabel
                  active={sortField === 'category_main'}
                  direction={sortField === 'category_main' ? sortDirection : 'asc'}
                  onClick={() => handleRequestSort('category_main')}
                >
                  Category
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 700, fontSize: '0.7rem', color: '#5f6368', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                <TableSortLabel
                  active={sortField === 'prospective_margin_pct'}
                  direction={sortField === 'prospective_margin_pct' ? sortDirection : 'asc'}
                  onClick={() => handleRequestSort('prospective_margin_pct')}
                >
                  Margin
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 700, fontSize: '0.7rem', color: '#007b5e', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                <TableSortLabel
                  active={sortField === 'our_price'}
                  direction={sortField === 'our_price' ? sortDirection : 'asc'}
                  onClick={() => handleRequestSort('our_price')}
                >
                  Bici
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 700, fontSize: '0.7rem', color: '#1a73e8', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Benchmark</TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 700, fontSize: '0.7rem', color: '#007b5e', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>New Price</TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa' }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProducts.map((product) => {
              const suggested = hasPricingRule ? getSuggestedPrice(product) : null;
              const diff = suggested !== null ? suggested - product.our_price : 0;
              const diffColor = diff < 0 ? theme.palette.success.main : diff > 0 ? theme.palette.error.main : '#a0a0a0';
              const isSelected = selectedRows.has(product.upc || product.system_sku);
              return (
                <TableRow
                  key={product.upc || product.system_sku}
                  hover
                  onClick={(event) => handleClick(event, product.upc || product.system_sku)}
                  role="checkbox"
                  aria-checked={isSelected}
                  selected={isSelected}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8f9fa !important' } }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={isSelected} />
                  </TableCell>
                  <TableCell sx={{ py: 1.5, fontWeight: 600 }}>{product.upc}</TableCell>
                  <TableCell sx={{ fontWeight: 500, maxWidth: 400 }}>{product.product_name}</TableCell>
                  <TableCell sx={{ py: 1.5, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    <Box display="flex" flexDirection="column">
                      <Typography variant="body2">{product.category_main}</Typography>
                      <Typography variant="caption" color="text.secondary">{product.subcategory_1}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    {product.prospective_margin_pct !== undefined && product.prospective_margin_pct !== null ? `${product.prospective_margin_pct}%` : '—'}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    ${Number(product.our_price).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const bench = product.competitors?.find(c => c.business_name === 'Google Benchmark');
                      if (!bench) return <Typography variant="caption" color="text.disabled">—</Typography>;
                      const isLower = bench.price < product.our_price;
                      const isHigher = bench.price > product.our_price;
                      return (
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            ${Number(bench.price).toFixed(2)}
                          </Typography>
                          {bench.price_diff_pct !== 0 && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: isLower ? '#28a745' : '#dc3545',
                                fontWeight: 700
                              }}
                            >
                              {isHigher ? '↑' : '↓'}{Math.abs(bench.price_diff_pct).toFixed(1)}%
                            </Typography>
                          )}
                        </Box>
                      );
                    })()}
                  </TableCell>

                  <TableCell>
                    {suggested !== null ? (
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#007b5e' }}>${Number(suggested).toFixed(2)}</Typography>
                        <Typography variant="caption" sx={{ color: diffColor }}>{diff >= 0 ? '+' : ''}{diff.toFixed(2)}</Typography>
                      </Box>
                    ) : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small">
                      <TimelineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Products;
