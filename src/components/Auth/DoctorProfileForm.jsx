import React, { useState, useEffect } from 'react';
import db from '../../db/index.js';

export default function DoctorProfileForm({ onSaved, initialData = null }) {
    const [formData, setFormData] = useState({
        name: '',
        medical_license: '',
        specialty: '',
        phone: '',
        email: '',
        address: '',
        logo_data: '',
        signature_data: ''
    });

    useEffect(() => {
        if (initialData) setFormData(initialData);
    }, [initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFile = (e, field) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, [field]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const id = initialData?.id || crypto.randomUUID();
            const now = new Date().toISOString();

            const sql = `
        INSERT OR REPLACE INTO doctor_profile 
        (id, name, medical_license, specialty, phone, email, address, logo_data, signature_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            await db.run(sql, [
                id,
                formData.name,
                formData.medical_license,
                formData.specialty,
                formData.phone,
                formData.email,
                formData.address,
                formData.logo_data,
                formData.signature_data,
                initialData?.created_at || now,
                now
            ]);

            if (onSaved) onSaved();
        } catch (err) {
            console.error(err);
            alert("Error guardando perfil: " + err.message);
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
            <div className="card">
                <h2 style={{ marginBottom: '20px', color: 'var(--primary)' }}>
                    {initialData ? 'Editar Perfil' : 'Completar Perfil del Médico'}
                </h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }} data-testid="form-doctor-profile">
                    <label>
                        Nombre Completo *
                        <input
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            placeholder="Dr. Juan Pérez"
                            data-testid="input-medical-name"
                        />
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <label>
                            Especialidad
                            <input
                                name="specialty"
                                value={formData.specialty}
                                onChange={handleChange}
                                placeholder="Cardiología"
                                data-testid="input-specialty"
                            />
                        </label>
                        <label>
                            Registro Médico / Licencia
                            <input
                                name="medical_license"
                                value={formData.medical_license}
                                onChange={handleChange}
                                placeholder="RM-12345"
                                data-testid="input-medical-license"
                            />
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <label>
                            Teléfono
                            <input
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </label>
                        <label>
                            Email
                            <input
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </label>
                    </div>

                    <label>
                        Dirección del Consultorio
                        <input
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                        />
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <label>
                            Logo (Imagen)
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFile(e, 'logo_data')}
                            />
                            {formData.logo_data && (
                                <img src={formData.logo_data} alt="Logo Preview" style={{ height: '50px', marginTop: '5px', objectFit: 'contain' }} />
                            )}
                        </label>
                        <label>
                            Firma (Imagen)
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFile(e, 'signature_data')}
                            />
                            {formData.signature_data && (
                                <img src={formData.signature_data} alt="Signature Preview" style={{ height: '50px', marginTop: '5px', objectFit: 'contain' }} />
                            )}
                        </label>
                    </div>

                    <button type="submit" style={{ marginTop: '10px' }} data-testid="btn-save-profile">
                        Guardar Perfil
                    </button>
                </form>
            </div>
        </div>
    );
}
