import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Typography,
  Checkbox,
  Paper,
} from '@mui/material';
import { Add, Delete, Edit, Visibility, VisibilityOff } from '@mui/icons-material';

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

export default function IncentiveRulesManager({ rulesText, onRulesChange }) {
  const [tabValue, setTabValue] = useState(0);
  const [config, setConfig] = useState({ version: 1, renewal_multiplier: 0.5, products: [] });
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Product dialog
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', active: true });
  const [editingProductIndex, setEditingProductIndex] = useState(null);

  // Rule dialog
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    mode: 'set',
    min_qty: null,
    max_qty: null,
    min_rate: null,
    max_rate: null,
    min_price: null,
    max_price: null,
    flat: null,
    percent_of_price: null,
    priority: 0,
  });
  const [editingRuleIndex, setEditingRuleIndex] = useState(null);

  // Load from JSON
  useEffect(() => {
    try {
      const parsed = JSON.parse(rulesText || '{}');
      if (parsed.version === 1 && Array.isArray(parsed.products)) {
        setConfig(parsed);
        setProducts(parsed.products || []);
        if (parsed.products?.length > 0) {
          setSelectedProduct(parsed.products[0]);
        }
      }
    } catch (error) {
      console.error('Failed to parse rules:', error);
    }
  }, [rulesText]);

  // Update JSON when config changes
  const updateRulesJson = (newConfig) => {
    onRulesChange(JSON.stringify(newConfig, null, 2));
  };

  // Product Management
  const openProductDialog = (index = null) => {
    if (index !== null) {
      const product = products[index];
      setProductForm({ name: product.name, active: product.active !== false });
      setEditingProductIndex(index);
    } else {
      setProductForm({ name: '', active: true });
      setEditingProductIndex(null);
    }
    setProductDialogOpen(true);
  };

  const saveProduct = () => {
    if (!productForm.name.trim()) {
      alert('Product name is required');
      return;
    }

    const newProducts = [...products];
    if (editingProductIndex !== null) {
      newProducts[editingProductIndex] = {
        ...newProducts[editingProductIndex],
        name: productForm.name,
        active: productForm.active,
      };
    } else {
      newProducts.push({
        name: productForm.name,
        active: productForm.active,
        rules: [{ mode: 'set', flat: 0 }],
      });
    }

    setProducts(newProducts);
    const newConfig = { ...config, products: newProducts };
    setConfig(newConfig);
    updateRulesJson(newConfig);

    if (selectedProduct?.name === productForm.name || editingProductIndex === null) {
      setSelectedProduct(newProducts[editingProductIndex ?? newProducts.length - 1]);
    }

    setProductDialogOpen(false);
  };

  const deleteProduct = (index) => {
    if (confirm('Delete this product?')) {
      const newProducts = products.filter((_, i) => i !== index);
      setProducts(newProducts);
      const newConfig = { ...config, products: newProducts };
      setConfig(newConfig);
      updateRulesJson(newConfig);

      if (selectedProduct?.name === products[index].name) {
        setSelectedProduct(newProducts[0] || null);
      }
    }
  };

  const toggleProductActive = (index) => {
    const newProducts = [...products];
    newProducts[index] = { ...newProducts[index], active: !newProducts[index].active };
    setProducts(newProducts);
    const newConfig = { ...config, products: newProducts };
    setConfig(newConfig);
    updateRulesJson(newConfig);

    if (selectedProduct?.name === newProducts[index].name) {
      setSelectedProduct(newProducts[index]);
    }
  };

  // Rule Management
  const openRuleDialog = (ruleIndex = null) => {
    if (ruleIndex !== null && selectedProduct) {
      const rule = selectedProduct.rules[ruleIndex];
      setRuleForm({ ...rule });
      setEditingRuleIndex(ruleIndex);
    } else {
      setRuleForm({
        mode: 'set',
        min_qty: null,
        max_qty: null,
        min_rate: null,
        max_rate: null,
        min_price: null,
        max_price: null,
        flat: null,
        percent_of_price: null,
        priority: 0,
      });
      setEditingRuleIndex(null);
    }
    setRuleDialogOpen(true);
  };

  const saveRule = () => {
    if (!selectedProduct) return;

    const rule = { ...ruleForm };
    // Convert strings to numbers
    Object.keys(rule).forEach((key) => {
      if (['min_qty', 'max_qty', 'min_rate', 'max_rate', 'min_price', 'max_price', 'flat', 'percent_of_price', 'priority'].includes(key)) {
        const val = rule[key];
        rule[key] = val === '' || val === null ? null : Number(val);
      }
    });

    // Validate
    if (rule.flat === null && rule.percent_of_price === null) {
      alert('Rule must have either a flat amount or percent of price');
      return;
    }

    const productIndex = products.findIndex((p) => p.name === selectedProduct.name);
    if (productIndex < 0) return;

    const newProducts = [...products];
    const newRules = [...(selectedProduct.rules || [])];

    if (editingRuleIndex !== null) {
      newRules[editingRuleIndex] = rule;
    } else {
      newRules.push(rule);
    }

    newProducts[productIndex] = { ...newProducts[productIndex], rules: newRules };
    setProducts(newProducts);
    setSelectedProduct({ ...newProducts[productIndex] });

    const newConfig = { ...config, products: newProducts };
    setConfig(newConfig);
    updateRulesJson(newConfig);

    setRuleDialogOpen(false);
  };

  const deleteRule = (ruleIndex) => {
    if (!selectedProduct) return;

    const productIndex = products.findIndex((p) => p.name === selectedProduct.name);
    if (productIndex < 0) return;

    const newProducts = [...products];
    const newRules = selectedProduct.rules.filter((_, i) => i !== ruleIndex);

    if (newRules.length === 0) {
      newRules.push({ mode: 'set', flat: 0 });
    }

    newProducts[productIndex] = { ...newProducts[productIndex], rules: newRules };
    setProducts(newProducts);
    setSelectedProduct({ ...newProducts[productIndex] });

    const newConfig = { ...config, products: newProducts };
    setConfig(newConfig);
    updateRulesJson(newConfig);
  };

  const handleRuleFormChange = (field, value) => {
    setRuleForm((prev) => ({ ...prev, [field]: value }));
  };

  const nonZeroFlat = (flat) => {
    if (flat === null || flat === undefined || flat === '') return '—';
    return flat === 0 ? '₹0' : `₹${flat}`;
  };

  const nonZeroPercent = (pct) => {
    if (pct === null || pct === undefined || pct === '') return '—';
    return `${(pct * 100).toFixed(1)}%`;
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab label="Products" />
              <Tab label="Incentive Rules" />
              <Tab label="JSON View" />
            </Tabs>
          </Box>

          {/* Products Tab */}
          <TabPanel value={tabValue} index={0}>
            <Stack spacing={2}>
              <Button variant="contained" startIcon={<Add />} onClick={() => openProductDialog()}>
                Add Product
              </Button>

              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell>Product Name</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {products.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell>{product.name}</TableCell>
                        <TableCell align="center">
                          <Chip
                            icon={product.active !== false ? <Visibility /> : <VisibilityOff />}
                            label={product.active !== false ? 'Active' : 'Inactive'}
                            color={product.active !== false ? 'success' : 'default'}
                            variant="outlined"
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => toggleProductActive(index)}
                            title={product.active !== false ? 'Disable' : 'Enable'}
                          >
                            {product.active !== false ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
                          </IconButton>
                          <IconButton size="small" onClick={() => openProductDialog(index)}>
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => deleteProduct(index)} color="error">
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="caption" color="text.secondary">
                {products.length} product(s) configured
              </Typography>
            </Stack>
          </TabPanel>

          {/* Rules Tab */}
          <TabPanel value={tabValue} index={1}>
            <Stack spacing={2}>
              {selectedProduct ? (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {selectedProduct.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {selectedProduct.rules?.length || 0} rule(s)
                      </Typography>
                    </Box>
                    <Box>
                      <TextField
                        select
                        size="small"
                        label="Product"
                        value={selectedProduct.name}
                        onChange={(e) => {
                          const prod = products.find((p) => p.name === e.target.value);
                          setSelectedProduct(prod);
                        }}
                        sx={{ minWidth: 200 }}
                      >
                        {products.map((product) => (
                          <MenuItem key={product.name} value={product.name}>
                            {product.name} {product.active === false ? '(Inactive)' : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                  </Box>

                  <Button variant="contained" startIcon={<Add />} onClick={() => openRuleDialog()}>
                    Add Rule
                  </Button>

                  {selectedProduct.active === false && (
                    <Alert severity="info">This product is inactive. Employees cannot submit it.</Alert>
                  )}

                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                          <TableCell>Mode</TableCell>
                          <TableCell>Qty Range</TableCell>
                          <TableCell>Rate Range</TableCell>
                          <TableCell>Price Range</TableCell>
                          <TableCell>Flat</TableCell>
                          <TableCell>% of Price</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(selectedProduct.rules || []).map((rule, index) => (
                          <TableRow key={index}>
                            <TableCell sx={{ fontWeight: 600 }}>{rule.mode || 'set'}</TableCell>
                            <TableCell fontSize="small">
                              {rule.min_qty !== null && rule.min_qty !== undefined ? `${rule.min_qty.toLocaleString()}` : '0'}
                              {rule.max_qty !== null && rule.max_qty !== undefined ? `–${rule.max_qty.toLocaleString()}` : '+'}
                            </TableCell>
                            <TableCell fontSize="small">
                              {rule.min_rate !== null && rule.min_rate !== undefined
                                ? `${Number(rule.min_rate).toFixed(3)}`
                                : '—'}
                              {rule.max_rate !== null && rule.max_rate !== undefined
                                ? `–${Number(rule.max_rate).toFixed(3)}`
                                : ''}
                            </TableCell>
                            <TableCell fontSize="small">
                              {rule.min_price !== null && rule.min_price !== undefined
                                ? `₹${rule.min_price.toLocaleString()}`
                                : '—'}
                              {rule.max_price !== null && rule.max_price !== undefined
                                ? `–₹${rule.max_price.toLocaleString()}`
                                : ''}
                            </TableCell>
                            <TableCell align="center">{rule.flat !== null ? `₹${rule.flat}` : '—'}</TableCell>
                            <TableCell align="center">
                              {rule.percent_of_price !== null ? `${(rule.percent_of_price * 100).toFixed(1)}%` : '—'}
                            </TableCell>
                            <TableCell align="right">
                              <IconButton size="small" onClick={() => openRuleDialog(index)}>
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton size="small" onClick={() => deleteRule(index)} color="error">
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              ) : (
                <Typography color="text.secondary">No products. Please add a product first.</Typography>
              )}
            </Stack>
          </TabPanel>

          {/* JSON View Tab */}
          <TabPanel value={tabValue} index={2}>
            <TextField
              multiline
              minRows={15}
              fullWidth
              value={rulesText}
              onChange={(e) => onRulesChange(e.target.value)}
              sx={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              For power users: Edit raw JSON directly. Changes are reflected in other tabs after refresh.
            </Typography>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Product Dialog */}
      <Dialog open={productDialogOpen} onClose={() => setProductDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProductIndex !== null ? 'Edit Product' : 'Add Product'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Product Name"
              fullWidth
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              placeholder="e.g., Bulk SMS"
            />
            <FormControlLabel
              control={<Checkbox checked={productForm.active} onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })} />}
              label="Active (employees can submit)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveProduct} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onClose={() => setRuleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRuleIndex !== null ? 'Edit Rule' : 'Add Incentive Rule'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              select
              label="Mode"
              value={ruleForm.mode || 'set'}
              onChange={(e) => handleRuleFormChange('mode', e.target.value)}
              fullWidth
            >
              <MenuItem value="set">Set (Replace)</MenuItem>
              <MenuItem value="add">Add (Cumulative)</MenuItem>
            </TextField>

            <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 600 }}>
              Conditions (leave blank for no limit)
            </Typography>

            <TextField
              label="Min Quantity"
              type="number"
              value={ruleForm.min_qty ?? ''}
              onChange={(e) => handleRuleFormChange('min_qty', e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
              inputProps={{ step: 1 }}
            />

            <TextField
              label="Max Quantity"
              type="number"
              value={ruleForm.max_qty ?? ''}
              onChange={(e) => handleRuleFormChange('max_qty', e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
              inputProps={{ step: 1 }}
            />

            <TextField
              label="Min Rate (₹)"
              type="number"
              value={ruleForm.min_rate ?? ''}
              onChange={(e) => handleRuleFormChange('min_rate', e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
              inputProps={{ step: 0.001 }}
            />

            <TextField
              label="Max Rate (₹)"
              type="number"
              value={ruleForm.max_rate ?? ''}
              onChange={(e) => handleRuleFormChange('max_rate', e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
              inputProps={{ step: 0.001 }}
            />

            <TextField
              label="Min Price (₹)"
              type="number"
              value={ruleForm.min_price ?? ''}
              onChange={(e) => handleRuleFormChange('min_price', e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
              inputProps={{ step: 1 }}
            />

            <TextField
              label="Max Price (₹)"
              type="number"
              value={ruleForm.max_price ?? ''}
              onChange={(e) => handleRuleFormChange('max_price', e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
              inputProps={{ step: 1 }}
            />

            <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 600 }}>
              Incentive (at least one required)
            </Typography>

            <TextField
              label="Flat Amount (₹)"
              type="number"
              value={ruleForm.flat ?? ''}
              onChange={(e) => handleRuleFormChange('flat', e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
              inputProps={{ step: 1 }}
            />

            <TextField
              label="Percent of Sale Price (%)"
              type="number"
              value={ruleForm.percent_of_price === null ? '' : (ruleForm.percent_of_price * 100).toFixed(2)}
              onChange={(e) =>
                handleRuleFormChange('percent_of_price', e.target.value === '' ? null : Number(e.target.value) / 100)
              }
              fullWidth
              inputProps={{ step: 0.1, min: 0, max: 100 }}
            />

            <TextField
              label="Priority (higher executes first)"
              type="number"
              value={ruleForm.priority ?? 0}
              onChange={(e) => handleRuleFormChange('priority', Number(e.target.value))}
              fullWidth
              inputProps={{ step: 1 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveRule} variant="contained">
            Save Rule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
