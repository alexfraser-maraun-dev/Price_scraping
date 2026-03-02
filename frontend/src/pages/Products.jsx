import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Container, Typography, Box, Paper, CircularProgress,
  Alert, Button, TextField, Chip, Checkbox, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
  MenuItem, Select, FormControl, InputLabel
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
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import axios from 'axios';

// --- Mock Data (Updated to match new schema) ---
const mockData = [
  {
    system_sku: "ELE-30451", custom_sku: "SHI-RD-8150", upc: "123456789012",
    product_name: "Ultegra Di2 Rear Derailleur RD-R8150",
    our_price: 89.00, total_revenue: 12500.50,
    brand_name: "Shimano", category_main: "Components",
    subcategory_1: "Drivetrain", subcategory_2: "Derailleurs",
    competitors: [
      { business_name: "Primeau Velo", url: "https://primeauvelo.com/product/123", price: 92.40, price_diff_pct: 3.8 },
      { business_name: "Enroute", url: "https://enroute.cc/product/456", price: 95.00, price_diff_pct: 6.7 },
      { business_name: "The Bike Shop", url: "https://thebikeshop.com/item", price: 88.50, price_diff_pct: -0.6 },
      { business_name: "Steed Cycles", url: "https://steedcycles.com/wire", price: 91.75, price_diff_pct: 3.1 }
    ]
  },
  {
    system_sku: "ELE-30599", custom_sku: "SRA-CH-12", upc: "223456789012",
    product_name: "Force AXS 12-Speed Chain",
    our_price: 54.00, total_revenue: 8400.20,
    brand_name: "SRAM", category_main: "Components",
    subcategory_1: "Drivetrain", subcategory_2: "Chains",
    competitors: [
      { business_name: "Primeau Velo", url: "https://primeauvelo.com/product/789", price: 58.50, price_diff_pct: 8.3 },
      { business_name: "The Bike Shop", url: "https://thebikeshop.com/light", price: 55.20, price_diff_pct: 2.2 },
      { business_name: "Steed Cycles", url: "https://steedcycles.com/led", price: 56.80, price_diff_pct: 5.2 }
    ]
  },
  {
    system_sku: "FAS-10032", custom_sku: "SHI-BP-RES", upc: "323456789012",
    product_name: "XT Disc Brake Pad Set (Resin)",
    our_price: 42.50, total_revenue: 4200.00,
    brand_name: "Shimano", category_main: "Components",
    subcategory_1: "Brakes", subcategory_2: "Brake Pads",
    competitors: [
      { business_name: "Primeau Velo", url: "https://primeauvelo.com/bolt", price: 45.99, price_diff_pct: 8.2 },
      { business_name: "Enroute", url: "https://enroute.cc/bolt", price: 41.20, price_diff_pct: -3.1 },
      { business_name: "The Bike Shop", url: "https://thebikeshop.com/bolt", price: 43.75, price_diff_pct: 2.9 },
      { business_name: "Steed Cycles", url: "https://steedcycles.com/bolt", price: 44.10, price_diff_pct: 3.8 }
    ]
  },
  {
    system_sku: "FAS-10078", custom_sku: "FOX-FK-29", upc: "423456789012",
    product_name: "34 Factory Float GRIP2 Fork 29\"",
    our_price: 1034.25, total_revenue: 25000.00,
    brand_name: "Fox", category_main: "Components",
    subcategory_1: "Suspension", subcategory_2: "Forks",
    competitors: [
      { business_name: "Primeau Velo", url: "https://primeauvelo.com/screw", price: 1036.80, price_diff_pct: 0.2 },
      { business_name: "Enroute", url: "https://enroute.cc/screw", price: 1020.50, price_diff_pct: -1.3 },
      { business_name: "The Bike Shop", url: "https://thebikeshop.com/screw", price: 1035.10, price_diff_pct: 0.1 },
      { business_name: "Steed Cycles", url: "https://steedcycles.com/screw", price: 1049.99, price_diff_pct: 1.5 }
    ]
  },
  {
    system_sku: "BIK-20100", custom_sku: "SRA-HB-CARB", upc: "523456789012",
    product_name: "Carbon Handlebar 31.8mm, 420mm Width",
    our_price: 129.99, total_revenue: 9500.00,
    brand_name: "SRAM", category_main: "Components",
    subcategory_1: "Cockpit", subcategory_2: "Handlebars",
    competitors: [
      { business_name: "Primeau Velo", url: "https://primeauvelo.com/bar", price: 134.99, price_diff_pct: 3.8 },
      { business_name: "Enroute", url: "https://enroute.cc/bar", price: 127.50, price_diff_pct: -1.9 },
      { business_name: "The Bike Shop", url: "https://thebikeshop.com/bar", price: 131.00, price_diff_pct: 0.8 },
      { business_name: "Steed Cycles", url: "https://steedcycles.com/bar", price: 139.99, price_diff_pct: 7.7 }
    ]
  },
  {
    system_sku: "BIK-20200", custom_sku: "FOX-TAPE-25", upc: "623456789012",
    product_name: "Tubeless Ready Rim Tape 25mm x 10m",
    our_price: 12.50, total_revenue: 2200.00,
    brand_name: "Fox", category_main: "Accessories",
    subcategory_1: "Wheels", subcategory_2: "Tape & Sealant",
    competitors: [
      { business_name: "Primeau Velo", url: "https://primeauvelo.com/tape", price: 13.88, price_diff_pct: 11.0 },
      { business_name: "Enroute", url: "https://enroute.cc/tape", price: 14.29, price_diff_pct: 14.3 },
      { business_name: "The Bike Shop", url: "https://thebikeshop.com/tape", price: 11.99, price_diff_pct: -4.1 },
      { business_name: "Steed Cycles", url: "https://steedcycles.com/tape", price: 13.50, price_diff_pct: 8.0 }
    ]
  }
];

const TARGET_COMPETITORS = [
  "primeauvelo.com",
  "enroute.cc",
  "thebikeshop.com",
  "steedcycles.com"
];

const Products = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Pricing rule state
  const [pricingRule, setPricingRule] = useState('none');
  const [pctChange, setPctChange] = useState('');
  const [dollarChange, setDollarChange] = useState('');

  // Sort state
  const [sortField, setSortField] = useState('system_sku');
  const [sortDirection, setSortDirection] = useState('asc');

  // Filter state
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcat1, setFilterSubcat1] = useState('');
  const [filterSubcat2, setFilterSubcat2] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [marketFilter, setMarketFilter] = useState(''); // 'below' | 'above' | ''

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/api/products');
      setProducts(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Backend not connected. Showing mock data for UI testing.');
      setProducts(mockData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // --- CSV Upload handler ---
  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { setError('CSV file appears empty.'); return; }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

        const parsed = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/['"]/g, ''));
          const row = {};
          headers.forEach((h, i) => { row[h] = vals[i] || ''; });

          return {
            system_sku: row['system_sku'] || '',
            custom_sku: row['custom_sku'] || '',
            upc: row['upc'] || '',
            product_name: row['product_name'] || '',
            our_price: parseFloat(row['current_default_price'] || 0),
            brand_name: row['brand_name'] || '',
            category_main: row['category_main'] || '',
            subcategory_1: row['subcategory_1'] || '',
            subcategory_2: row['subcategory_2'] || '',
            total_revenue: parseFloat(row['total_revenue'] || 0),
            competitors: []
          };
        }).filter(p => p.system_sku);

        setProducts(parsed);
        setError(`Loaded ${parsed.length} products from CSV upload.`);
      } catch (err) {
        setError('Failed to parse CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // --- Derive unique filter options from data ---
  const filterOptions = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category_main).filter(Boolean))].sort();
    const sub1s = [...new Set(products.map(p => p.subcategory_1).filter(Boolean))].sort();
    const sub2s = [...new Set(products.map(p => p.subcategory_2).filter(Boolean))].sort();
    const brands = [...new Set(products.map(p => p.brand_name).filter(Boolean))].sort();
    return { cats, sub1s, sub2s, brands };
  }, [products]);

  // --- Helpers: compare against market average ---
  const getAvgCompPrice = (p) => {
    const compPrices = p.competitors?.map(c => c.price).filter(Boolean) || [];
    return compPrices.length > 0 ? compPrices.reduce((a, b) => a + b, 0) / compPrices.length : null;
  };

  // "Below Market Avg" = our price is ABOVE the avg competitor price (we're overpriced)
  const isBelowMarket = (p) => {
    const avg = getAvgCompPrice(p);
    return avg !== null && p.our_price > avg;
  };
  // "Above Market Avg" = our price is AT or BELOW the avg competitor price (we're competitive)
  const isAboveMarket = (p) => {
    const avg = getAvgCompPrice(p);
    return avg !== null && p.our_price <= avg;
  };

  const totalBelowMarketDollars = useMemo(() => {
    return products.reduce((acc, p) => {
      const avg = getAvgCompPrice(p);
      if (avg !== null && p.our_price > avg) {
        acc += (p.our_price - avg);
      }
      return acc;
    }, 0);
  }, [products]);

  const totalBelowMarketPct = useMemo(() => {
    let totalOurPrice = 0;
    let totalDiff = 0;
    products.forEach(p => {
      const avg = getAvgCompPrice(p);
      if (avg !== null && p.our_price > avg) {
        totalOurPrice += p.our_price;
        totalDiff += (p.our_price - avg);
      }
    });
    return totalOurPrice > 0 ? (totalDiff / totalOurPrice * 100) : 0;
  }, [products]);

  // --- Calculate suggested price ---
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
      case 'beat_average': basePrice = avgComp * 0.98; break;
      case 'match_highest': basePrice = highestComp; break;
      default: basePrice = product.our_price;
    }
    if (pctChange && !isNaN(parseFloat(pctChange))) basePrice *= (1 + parseFloat(pctChange) / 100);
    if (dollarChange && !isNaN(parseFloat(dollarChange))) basePrice += parseFloat(dollarChange);
    return Math.max(0, parseFloat(basePrice.toFixed(2)));
  };

  // --- Export ---
  const handleExportCSV = () => {
    const selectedProducts = products.filter(p => selectedRows.has(p.system_sku));
    if (selectedProducts.length === 0) return;
    const header = 'system_id,default_price';
    const rows = selectedProducts.map(p => {
      const suggested = getSuggestedPrice(p);
      return `${p.system_sku},${suggested !== null ? suggested : p.our_price}`;
    });
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'price_adjustments.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasPricingRule = pricingRule !== 'none' || pctChange || dollarChange;

  // --- Filtering & Sorting ---
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = !search ||
        p.product_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.system_sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.custom_sku?.toLowerCase().includes(search.toLowerCase());
      const matchesCat = !filterCategory || p.category_main === filterCategory;
      const matchesSub1 = !filterSubcat1 || p.subcategory_1 === filterSubcat1;
      const matchesSub2 = !filterSubcat2 || p.subcategory_2 === filterSubcat2;
      const matchesBrand = !filterBrand || p.brand_name === filterBrand;
      const matchesMarket = !marketFilter ||
        (marketFilter === 'below' && isBelowMarket(p)) ||
        (marketFilter === 'above' && isAboveMarket(p));
      return matchesSearch && matchesCat && matchesSub1 && matchesSub2 && matchesBrand && matchesMarket;
    });
    result.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      return sortDirection === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
    return result;
  }, [products, search, sortField, sortDirection, filterCategory, filterSubcat1, filterSubcat2, filterBrand, marketFilter]);

  const handleSort = (field) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedRows(new Set(filteredProducts.map(p => p.system_sku)));
    else setSelectedRows(new Set());
  };

  const handleSelectRow = (sku) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(sku) ? next.delete(sku) : next.add(sku);
      return next;
    });
  };

  const ruleOptions = [
    { value: 'none', label: 'No Rule' },
    { value: 'match_lowest', label: 'Match Lowest Competitor' },
    { value: 'undercut_lowest', label: 'Undercut Lowest by 1%' },
    { value: 'match_average', label: 'Match Market Average' },
    { value: 'beat_average', label: 'Beat Average by 2%' },
    { value: 'match_highest', label: 'Match Highest Competitor' },
  ];

  const cellSx = { borderBottom: '1px solid #1f1f1f', color: '#fff', py: 1.5, fontSize: '0.85rem' };
  const headerSx = { borderBottom: '1px solid #1f1f1f', color: '#a0a0a0', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em', fontWeight: 600, whiteSpace: 'nowrap' };

  const selectSx = {
    minWidth: 140, '& .MuiOutlinedInput-root': { bgcolor: '#0a0a0a', borderRadius: '8px', fontSize: '0.85rem' },
    '& .MuiInputLabel-root': { color: '#666', fontSize: '0.8rem' },
    '& .MuiSelect-select': { py: 1 }
  };

  const renderCompetitorCell = (product, domain) => {
    const comp = product.competitors?.find(c => c.url.includes(domain));
    if (!comp) return <Typography variant="body2" sx={{ color: '#555' }}>N/A</Typography>;
    const isMoreExpensive = comp.price_diff_pct > 0;
    const color = isMoreExpensive ? theme.palette.error.main : theme.palette.success.main;
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{'$'}{comp.price.toFixed(2)}</Typography>
        <Typography variant="caption" sx={{ color, fontWeight: 600 }}>
          {isMoreExpensive ? '↑' : '↓'}{Math.abs(comp.price_diff_pct).toFixed(1)}%
        </Typography>
      </Box>
    );
  };

  const belowCount = products.filter(isBelowMarket).length;
  const aboveCount = products.filter(isAboveMarket).length;

  return (
    <Box sx={{ p: 3, pt: 4, flexGrow: 1 }}>
      <Container maxWidth={false}>

        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
          <Box>
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              SKU Headquarters
              <Chip size="small" label={`${filteredProducts.length} of ${products.length} SKUs`} sx={{ bgcolor: '#1a1a1a', color: '#a0a0a0', fontSize: '0.75rem' }} />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              BICI Competitive Price Tracker
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVUpload} style={{ display: 'none' }} />
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              sx={{ borderColor: '#333', color: '#fff' }}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              sx={{ borderColor: '#333', color: '#fff' }}
              onClick={handleExportCSV}
              disabled={selectedRows.size === 0}
            >
              Export CSV ({selectedRows.size})
            </Button>
            <Button variant="contained" color="primary" sx={{ color: '#000' }} startIcon={<RefreshIcon />} onClick={fetchProducts}>
              Run Scrape
            </Button>
          </Box>
        </Box>

        {/* Search */}
        <Box display="flex" gap={2} mb={2} flexWrap="wrap">
          <TextField
            placeholder="Search SKU, Product, or Custom SKU..."
            variant="outlined"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: '#555', mr: 1 }} />,
              sx: { bgcolor: '#121212', borderRadius: '8px', width: '350px', '& fieldset': { borderColor: '#333' } }
            }}
          />
        </Box>

        {/* Filter Dropdowns */}
        <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
          <FormControl size="small" sx={selectSx}>
            <InputLabel>Category</InputLabel>
            <Select value={filterCategory} label="Category" onChange={(e) => setFilterCategory(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {filterOptions.cats.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={selectSx}>
            <InputLabel>Subcategory 1</InputLabel>
            <Select value={filterSubcat1} label="Subcategory 1" onChange={(e) => setFilterSubcat1(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {filterOptions.sub1s.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={selectSx}>
            <InputLabel>Subcategory 2</InputLabel>
            <Select value={filterSubcat2} label="Subcategory 2" onChange={(e) => setFilterSubcat2(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {filterOptions.sub2s.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={selectSx}>
            <InputLabel>Brand</InputLabel>
            <Select value={filterBrand} label="Brand" onChange={(e) => setFilterBrand(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {filterOptions.brands.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          {(filterCategory || filterSubcat1 || filterSubcat2 || filterBrand || marketFilter) && (
            <Button size="small" onClick={() => { setFilterCategory(''); setFilterSubcat1(''); setFilterSubcat2(''); setFilterBrand(''); setMarketFilter(''); }} sx={{ color: '#a0a0a0' }}>
              Clear Filters
            </Button>
          )}
        </Box>

        {/* Pricing Strategy */}
        <Paper sx={{ p: 2.5, mb: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ minWidth: 120 }}>PRICING STRATEGY</Typography>
          <TextField select size="small" value={pricingRule} onChange={(e) => setPricingRule(e.target.value)} SelectProps={{ native: true }}
            sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { bgcolor: '#0a0a0a', borderRadius: '8px' } }}>
            {ruleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </TextField>
          <TextField placeholder="% change" size="small" type="number" value={pctChange} onChange={(e) => setPctChange(e.target.value)}
            sx={{ width: 120, '& .MuiOutlinedInput-root': { bgcolor: '#0a0a0a', borderRadius: '8px' } }}
            InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">%</Typography> }} />
          <TextField placeholder="$ change" size="small" type="number" value={dollarChange} onChange={(e) => setDollarChange(e.target.value)}
            sx={{ width: 120, '& .MuiOutlinedInput-root': { bgcolor: '#0a0a0a', borderRadius: '8px' } }}
            InputProps={{ startAdornment: <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>$</Typography> }} />
          {hasPricingRule && (
            <Button size="small" onClick={() => { setPricingRule('none'); setPctChange(''); setDollarChange(''); }} sx={{ color: '#a0a0a0' }}>Clear</Button>
          )}
        </Paper>

        {error && <Alert severity="warning" sx={{ mb: 3, bgcolor: '#332a00', color: '#ffd700', border: '1px solid #ffd700' }}>{error}</Alert>}

        {/* Summary Cards */}
        <Box display="flex" gap={3} mb={3} flexWrap="wrap">
          <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 200px' }}>
            <Box sx={{ bgcolor: '#0a1f16', p: 1.5, borderRadius: 2 }}>
              <AttachMoneyIcon sx={{ color: theme.palette.primary.main }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">AVG OUR PRICE</Typography>
              <Typography variant="h5" fontWeight="bold">
                {'$'}{products.length > 0 ? (products.reduce((acc, p) => acc + (p.our_price || 0), 0) / products.length).toFixed(2) : '0.00'}
              </Typography>
            </Box>
          </Paper>

          <Paper
            onClick={() => setMarketFilter(marketFilter === 'below' ? '' : 'below')}
            sx={{
              p: 2.5, display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 200px', cursor: 'pointer',
              border: marketFilter === 'below' ? `2px solid ${theme.palette.success.main}` : '1px solid #1f1f1f',
              transition: 'border 0.2s', '&:hover': { borderColor: theme.palette.success.main }
            }}
          >
            <Box sx={{ bgcolor: '#0a1f16', p: 1.5, borderRadius: 2 }}>
              <TrendingDownIcon sx={{ color: theme.palette.success.main }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">BELOW MKT AVG</Typography>
              <Typography variant="h5" fontWeight="bold">
                {belowCount}{' '}<Typography component="span" color="text.secondary" variant="body2">SKUs</Typography>
              </Typography>
            </Box>
          </Paper>

          <Paper
            onClick={() => setMarketFilter(marketFilter === 'above' ? '' : 'above')}
            sx={{
              p: 2.5, display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 200px', cursor: 'pointer',
              border: marketFilter === 'above' ? `2px solid ${theme.palette.error.main}` : '1px solid #1f1f1f',
              transition: 'border 0.2s', '&:hover': { borderColor: theme.palette.error.main }
            }}
          >
            <Box sx={{ bgcolor: '#330a0a', p: 1.5, borderRadius: 2 }}>
              <TrendingUpIcon sx={{ color: theme.palette.error.main }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">ABOVE MKT AVG</Typography>
              <Typography variant="h5" fontWeight="bold">
                {aboveCount}{' '}<Typography component="span" color="text.secondary" variant="body2">SKUs</Typography>
              </Typography>
            </Box>
          </Paper>

          <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 200px' }}>
            <Box sx={{ bgcolor: '#331a00', p: 1.5, borderRadius: 2 }}>
              <WarningAmberIcon sx={{ color: '#ff8c00' }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">TOTAL $ BELOW MKT AVG</Typography>
              <Typography variant="h5" fontWeight="bold" sx={{ color: theme.palette.error.main }}>
                {'$'}{totalBelowMarketDollars.toFixed(2)}
              </Typography>
            </Box>
          </Paper>

          <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 200px' }}>
            <Box sx={{ bgcolor: '#331a00', p: 1.5, borderRadius: 2 }}>
              <TrendingUpIcon sx={{ color: '#ff8c00' }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">TOTAL % BELOW MKT AVG</Typography>
              <Typography variant="h5" fontWeight="bold" sx={{ color: theme.palette.error.main }}>
                {totalBelowMarketPct.toFixed(1)}{'%'}
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* Main Table */}
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="400px">
              <CircularProgress sx={{ color: theme.palette.primary.main }} />
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { bgcolor: 'transparent' } }}>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#0a0a0a' } }}>
                    <TableCell padding="checkbox" sx={headerSx}>
                      <Checkbox sx={{ color: '#555', '&.Mui-checked': { color: theme.palette.primary.main } }}
                        indeterminate={selectedRows.size > 0 && selectedRows.size < filteredProducts.length}
                        checked={filteredProducts.length > 0 && selectedRows.size === filteredProducts.length}
                        onChange={handleSelectAll} />
                    </TableCell>
                    {[
                      { field: 'system_sku', label: 'SKU' },
                      { field: 'product_name', label: 'Product' },
                      { field: 'brand_name', label: 'Brand' },
                      { field: 'category_main', label: 'Category' },
                      { field: 'our_price', label: 'Our Price' }
                    ].map(col => (
                      <TableCell key={col.field} sx={headerSx}>
                        <TableSortLabel active={sortField === col.field} direction={sortField === col.field ? sortDirection : 'asc'} onClick={() => handleSort(col.field)}
                          sx={{ color: '#a0a0a0 !important', '& .MuiTableSortLabel-icon': { color: '#a0a0a0 !important' } }}>
                          {col.label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                    {TARGET_COMPETITORS.map(domain => (
                      <TableCell key={domain} sx={headerSx}>{domain.split('.')[0].toUpperCase()}</TableCell>
                    ))}
                    {hasPricingRule && <TableCell sx={headerSx}>Suggested</TableCell>}
                    <TableCell sx={headerSx} align="center"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const suggested = hasPricingRule ? getSuggestedPrice(product) : null;
                    const diff = suggested !== null ? suggested - product.our_price : 0;
                    const diffColor = diff < 0 ? theme.palette.success.main : diff > 0 ? theme.palette.error.main : '#a0a0a0';
                    return (
                      <TableRow key={product.system_sku} hover sx={{ '&:hover': { bgcolor: '#1a1a1a !important' } }}>
                        <TableCell padding="checkbox" sx={cellSx}>
                          <Checkbox sx={{ color: '#555', '&.Mui-checked': { color: theme.palette.primary.main } }}
                            checked={selectedRows.has(product.system_sku)} onChange={() => handleSelectRow(product.system_sku)} />
                        </TableCell>
                        <TableCell sx={cellSx}>
                          {product.system_sku}
                          {product.custom_sku && <Typography variant="caption" display="block" color="text.secondary">{product.custom_sku}</Typography>}
                        </TableCell>
                        <TableCell sx={{ ...cellSx, maxWidth: 300 }}>{product.product_name}</TableCell>
                        <TableCell sx={cellSx}>{product.brand_name || '—'}</TableCell>
                        <TableCell sx={cellSx}>{product.category_main || '—'}</TableCell>
                        <TableCell sx={cellSx}>
                          <Box sx={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', px: 1.5, py: 0.5, display: 'inline-block' }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{'$'}{Number(product.our_price || 0).toFixed(2)}</Typography>
                          </Box>
                        </TableCell>
                        {TARGET_COMPETITORS.map(domain => (
                          <TableCell key={domain} sx={cellSx}>{renderCompetitorCell(product, domain)}</TableCell>
                        ))}
                        {hasPricingRule && (
                          <TableCell sx={cellSx}>
                            {suggested !== null ? (
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>{'$'}{suggested.toFixed(2)}</Typography>
                                <Typography variant="caption" sx={{ color: diffColor }}>{diff >= 0 ? '+' : ''}{diff.toFixed(2)}</Typography>
                              </Box>
                            ) : '—'}
                          </TableCell>
                        )}
                        <TableCell sx={cellSx} align="center">
                          <Tooltip title="View price history">
                            <IconButton size="small" onClick={() => navigate(`/reports?sku=${product.system_sku}`)}
                              sx={{ color: '#a0a0a0', '&:hover': { color: theme.palette.primary.main } }}>
                              <TimelineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

      </Container>
    </Box>
  );
};

export default Products;
