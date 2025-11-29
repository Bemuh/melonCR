import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { openDb, exec, run } from '../db/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dbKey, setDbKey] = useState(null); // The decrypted Master Key
    const [inactivityTimeout, setInactivityTimeout] = useState(10); // Default 10 mins
    const inactivityTimer = useRef(null);

    // --- Inactivity Logic ---
    const resetTimer = () => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (user && inactivityTimeout > 0) {
            inactivityTimer.current = setTimeout(() => {
                logout();
            }, inactivityTimeout * 60 * 1000);
        }
    };

    useEffect(() => {
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        const handler = () => resetTimer();
        events.forEach(e => window.addEventListener(e, handler));
        return () => {
            events.forEach(e => window.removeEventListener(e, handler));
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        };
    }, [user, inactivityTimeout]);

    // --- Crypto Helpers ---
    async function deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
        );
    }

    async function generateMasterKey() {
        return window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    async function encryptMasterKey(masterKey, wrappingKey) {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const exportedMK = await window.crypto.subtle.exportKey("raw", masterKey);
        const encryptedMK = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            wrappingKey,
            exportedMK
        );
        return {
            encrypted: Array.from(new Uint8Array(encryptedMK)),
            iv: Array.from(iv)
        };
    }

    async function decryptMasterKey(encryptedMK, iv, wrappingKey) {
        const decryptedRaw = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(iv) },
            wrappingKey,
            new Uint8Array(encryptedMK)
        );
        return window.crypto.subtle.importKey(
            "raw", decryptedRaw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]
        );
    }

    // --- Auth Actions ---

    const login = async (username, password) => {
        try {
            const userData = await window.authApi.login(username);
            if (!userData) return { ok: false, error: "Usuario no encontrado" };

            const salt = new Uint8Array(userData.salt);
            const passwordKey = await deriveKey(password, salt);

            try {
                // Try to decrypt Master Key with password
                const masterKey = await decryptMasterKey(
                    userData.encryptedMK_password,
                    userData.iv_password,
                    passwordKey
                );

                // Login success
                setDbKey(masterKey);
                console.log('AuthContext: login successful, opening DB...');
                await openDb(username, masterKey);
                console.log('AuthContext: DB opened');
                setUser({ username }); // Set user AFTER DB is ready

                // Load settings
                try {
                    const rows = exec("SELECT value FROM settings WHERE key='inactivity_timeout'");
                    if (rows.length > 0) {
                        setInactivityTimeout(parseInt(rows[0].value, 10));
                    }
                } catch (e) {
                    console.warn("Failed to load settings:", e);
                }

                resetTimer();
                return { ok: true };
            } catch (e) {
                console.error(e);
                return { ok: false, error: "Contraseña incorrecta" };
            }
        } catch (e) {
            console.error(e);
            return { ok: false, error: "Error de sistema" };
        }
    };

    const createAccount = async (username, password) => {
        try {
            if (window.logTest) window.logTest('AuthContext: createAccount start ' + username);
            console.log('AuthContext: createAccount start', username);
            const exists = await window.authApi.login(username);
            if (exists) return { ok: false, error: "El usuario ya existe" };

            console.log('AuthContext: generating keys...');
            // 1. Generate Master Key
            if (!window.crypto || !window.crypto.subtle) {
                console.error('AuthContext: window.crypto.subtle is missing!');
                throw new Error('Crypto API missing');
            }
            const masterKey = await generateMasterKey();
            console.log('AuthContext: masterKey generated');

            // 2. Generate Salt
            const salt = window.crypto.getRandomValues(new Uint8Array(16));

            // 3. Encrypt MK with Password
            const passwordKey = await deriveKey(password, salt);
            const mkPassword = await encryptMasterKey(masterKey, passwordKey);
            console.log('AuthContext: mkPassword encrypted');

            // 4. Generate Recovery Code & Encrypt MK with it
            const recoveryCode = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase(); // 32 chars hex
            // Format: XXXX-XXXX-XXXX-XXXX...
            const formattedRecovery = recoveryCode.match(/.{1,4}/g).join('-');

            const recoveryKey = await deriveKey(formattedRecovery, salt);
            const mkRecovery = await encryptMasterKey(masterKey, recoveryKey);
            console.log('AuthContext: mkRecovery encrypted');

            const userData = {
                username,
                salt: Array.from(salt),
                encryptedMK_password: mkPassword.encrypted,
                iv_password: mkPassword.iv,
                encryptedMK_recovery: mkRecovery.encrypted,
                iv_recovery: mkRecovery.iv,
                created_at: new Date().toISOString()
            };

            await window.authApi.create(username, userData);
            console.log('AuthContext: user created in API');

            console.log('AuthContext: returning recovery code', formattedRecovery);
            return { ok: true, recoveryCode: formattedRecovery };
        } catch (e) {
            console.error('AuthContext: createAccount error', e);
            return { ok: false, error: "Error creando cuenta" };
        }
    };

    const recoverPassword = async (username, recoveryCode, newPassword) => {
        try {
            const userData = await window.authApi.login(username);
            if (!userData) return { ok: false, error: "Usuario no encontrado" };

            const salt = new Uint8Array(userData.salt);
            const recoveryKey = await deriveKey(recoveryCode, salt);

            let masterKey;
            try {
                masterKey = await decryptMasterKey(
                    userData.encryptedMK_recovery,
                    userData.iv_recovery,
                    recoveryKey
                );
            } catch (e) {
                return { ok: false, error: "Código de recuperación inválido" };
            }

            // Re-encrypt MK with new password
            const newPasswordKey = await deriveKey(newPassword, salt);
            const newMkPassword = await encryptMasterKey(masterKey, newPasswordKey);

            const updatedData = {
                encryptedMK_password: newMkPassword.encrypted,
                iv_password: newMkPassword.iv
            };

            await window.authApi.update(username, updatedData);
            return { ok: true };
        } catch (e) {
            console.error(e);
            return { ok: false, error: "Error en recuperación" };
        }
    };

    const changePassword = async (oldPassword, newPassword) => {
        try {
            if (!user) return { ok: false, error: "No autenticado" };
            const username = user.username;
            const userData = await window.authApi.login(username);

            const salt = new Uint8Array(userData.salt);
            const oldPasswordKey = await deriveKey(oldPassword, salt);

            let masterKey;
            try {
                masterKey = await decryptMasterKey(
                    userData.encryptedMK_password,
                    userData.iv_password,
                    oldPasswordKey
                );
            } catch (e) {
                return { ok: false, error: "Contraseña actual incorrecta" };
            }

            const newPasswordKey = await deriveKey(newPassword, salt);
            const newMkPassword = await encryptMasterKey(masterKey, newPasswordKey);

            const updatedData = {
                encryptedMK_password: newMkPassword.encrypted,
                iv_password: newMkPassword.iv
            };

            await window.authApi.update(username, updatedData);
            return { ok: true };
        } catch (e) {
            console.error(e);
            return { ok: false, error: "Error cambiando contraseña" };
        }
    };

    const updateInactivityTimeout = (minutes) => {
        try {
            run("INSERT OR REPLACE INTO settings (key, value) VALUES ('inactivity_timeout', $val)", { $val: String(minutes) });
            setInactivityTimeout(minutes);
        } catch (e) {
            console.error("Error saving setting:", e);
        }
    };

    const logout = () => {
        setUser(null);
        setDbKey(null);
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };

    return (
        <AuthContext.Provider value={{ user, login, createAccount, recoverPassword, changePassword, logout, dbKey, inactivityTimeout, updateInactivityTimeout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
