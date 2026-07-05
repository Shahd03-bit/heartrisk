import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import '../styles/EditProfile.css';

export default function EditProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    profilePicture: ''
  });

  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));

    if (storedUser) {
      setUser(storedUser);

      setFormData({
        firstName: storedUser.first_name || '',
        lastName: storedUser.last_name || '',
        profilePicture: storedUser.profile_picture || ''
      });

      setPreview(storedUser.profile_picture || '');
    }

    setLoading(false);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔥 BASE64 IMAGE
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2MB");
      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      const base64 = reader.result;

      setPreview(base64);

      setFormData((prev) => ({
        ...prev,
        profilePicture: base64
      }));
    };

    reader.readAsDataURL(file);
  };

  // 🚀 FAST SAVE (NON-BLOCKING)
 const handleSave = async (e) => {
  e.preventDefault();

  setSaving(true);
  setError('');

  try {
    if (!user?.id) {
      throw new Error("User not found");
    }

    const updatedUser = {
      ...user,
      first_name: formData.firstName,
      last_name: formData.lastName,
      profile_picture: formData.profilePicture
    };

    // 🔥 SAVE WITH TIMEOUT (MAX 5s)
    await Promise.race([
      (async () => {
        await updateDoc(doc(db, 'users', user.id), {
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          profilePicture: updatedUser.profile_picture
        });

        await updateProfile(auth.currentUser, {
          displayName: `${updatedUser.first_name} ${updatedUser.last_name}`
        });
      })(),

      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Saving timeout")), 5000)
      )
    ]);

    // ✅ UPDATE LOCAL AFTER SUCCESS
    localStorage.setItem('user', JSON.stringify(updatedUser));

    // ✅ NAVIGATE AFTER SAVE
    navigate('/dashboard');

  } catch (err) {
    console.error(err);

    if (err.message === "Saving timeout") {
      setError("Saving took too long. Check your internet or Firebase.");
    } else {
      setError(err.message);
    }

    setSaving(false);
  }
};
  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="edit-profile-container">
      <div className="edit-profile-card">

        <h1>Edit Profile</h1>

        <form onSubmit={handleSave}>

          {/* PROFILE IMAGE */}
          <div className="profile-picture-section">
            {preview ? (
              <img src={preview} alt="profile" className="preview-image" />
            ) : (
              <div className="avatar-placeholder">
                {formData.firstName.charAt(0).toUpperCase()}
              </div>
            )}

            <label className="upload-label">
              Upload Photo
              <input type="file" hidden onChange={handleImageChange} />
            </label>

            <p className="upload-hint">Max 2MB</p>
          </div>

          {/* INPUTS */}
          <div className="form-group">
            <label>First Name</label>
            <input
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Last Name</label>
            <input
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
            />
          </div>

          {/* ERROR */}
          {error && <div className="error-message">{error}</div>}

          {/* BUTTONS */}
          <div className="button-group">
            <button
              type="button"
              className="btn-cancel"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </button>

            <button className="btn-save" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}