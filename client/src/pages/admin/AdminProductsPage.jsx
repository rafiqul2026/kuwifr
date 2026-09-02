import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminProductsPage.module.css';

const AdminProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    shortDescription: '',
    mrp: '',
    ksp: '',
    kbp: '',
    category: 'OTHER',
    stock: '',
    isInStock: true,
    isActive: true,
    countryOfOrigin: 'India'
  });
  const { showNotification } = useNotification();

  const categories = [
    'HAIR_CARE', 'SKIN_CARE', 'HEALTH_SUPPLEMENT', 'CLOTHING',
    'WATER_PURIFIER', 'ELECTRONICS', 'VEHICLE', 'FOOD', 'OTHER'
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/products');
      if (response.data.success) {
        setProducts(response.data.data.products || []);
      }
    } catch (error) {
      showNotification('Failed to fetch products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        mrp: parseFloat(formData.mrp),
        ksp: parseFloat(formData.ksp),
        kbp: parseFloat(formData.kbp),
        stock: parseInt(formData.stock)
      };

      if (editingProduct) {
        await api.put(`/api/admin/products/${editingProduct._id}`, data);
        showNotification('Product updated successfully', 'success');
      } else {
        await api.post('/api/admin/products', data);
        showNotification('Product created successfully', 'success');
      }
      setShowModal(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (error) {
      showNotification(error.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/api/admin/products/${id}`);
      showNotification('Product deleted successfully', 'success');
      fetchProducts();
    } catch (error) {
      showNotification('Failed to delete product', 'error');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      description: product.description || '',
      shortDescription: product.shortDescription || '',
      mrp: product.mrp || '',
      ksp: product.ksp || '',
      kbp: product.kbp || '',
      category: product.category || 'OTHER',
      stock: product.stock || '',
      isInStock: product.isInStock !== undefined ? product.isInStock : true,
      isActive: product.isActive !== undefined ? product.isActive : true,
      countryOfOrigin: product.countryOfOrigin || 'India'
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      description: '',
      shortDescription: '',
      mrp: '',
      ksp: '',
      kbp: '',
      category: 'OTHER',
      stock: '',
      isInStock: true,
      isActive: true,
      countryOfOrigin: 'India'
    });
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading products...</p>
      </div>
    );
  }

  return (
    <div className={styles.productsPage}>
      <div className={styles.header}>
        <h1>Product Management</h1>
        <button 
          className={styles.createBtn}
          onClick={() => {
            setEditingProduct(null);
            resetForm();
            setShowModal(true);
          }}
        >
          + Add Product
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>MRP</th>
              <th>KSP</th>
              <th>KBP</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan="8" className={styles.emptyState}>No products found</td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product._id}>
                  <td>{product.name}</td>
                  <td>{product.sku}</td>
                  <td>₹{product.mrp}</td>
                  <td>₹{product.ksp}</td>
                  <td>{product.kbp}</td>
                  <td>{product.stock}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${product.isActive ? styles.active : styles.inactive}`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className={styles.editBtn} onClick={() => handleEdit(product)}>Edit</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(product._id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button className={styles.closeModalBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Product Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>SKU *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows="3"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Short Description</label>
                  <input
                    type="text"
                    value={formData.shortDescription}
                    onChange={(e) => setFormData({...formData, shortDescription: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>MRP (₹) *</label>
                  <input
                    type="number"
                    value={formData.mrp}
                    onChange={(e) => setFormData({...formData, mrp: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>KSP (₹) *</label>
                  <input
                    type="number"
                    value={formData.ksp}
                    onChange={(e) => setFormData({...formData, ksp: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>KBP *</label>
                  <input
                    type="number"
                    value={formData.kbp}
                    onChange={(e) => setFormData({...formData, kbp: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Stock *</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({...formData, stock: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Country of Origin</label>
                  <input
                    type="text"
                    value={formData.countryOfOrigin}
                    onChange={(e) => setFormData({...formData, countryOfOrigin: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isInStock}
                      onChange={(e) => setFormData({...formData, isInStock: e.target.checked})}
                    />
                    In Stock
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    />
                    Active
                  </label>
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  {editingProduct ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;