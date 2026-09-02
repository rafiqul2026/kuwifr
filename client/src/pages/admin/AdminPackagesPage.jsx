import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminPackagesPage.module.css';

const AdminPackagesPage = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/packages');
      if (response.data.success) {
        setPackages(response.data.data.packages || []);
      }
    } catch (error) {
      showNotification('Failed to fetch packages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this package?')) return;
    try {
      await api.delete(`/api/admin/packages/${id}`);
      showNotification('Package deleted', 'success');
      fetchPackages();
    } catch (error) {
      showNotification('Failed to delete package', 'error');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className={styles.packagesPage}>
      <div className={styles.header}>
        <h1>Package Management</h1>
        <button className={styles.createBtn}>+ Create Package</button>
      </div>
      
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Price</th>
              <th>KBP</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg) => (
              <tr key={pkg._id}>
                <td>{pkg.name}</td>
                <td>{pkg.type}</td>
                <td>₹{pkg.price?.toLocaleString()}</td>
                <td>{pkg.kbp}</td>
                <td>{pkg.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                  <button className={styles.editBtn}>Edit</button>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(pkg._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPackagesPage;