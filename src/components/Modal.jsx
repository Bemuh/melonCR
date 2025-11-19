import React from "react";

export default function Modal({
    title,
    children,
    onClose,
    onCancel,
    confirmText = "Aceptar",
    cancelText = "Cancelar",
}) {
    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
            }}
        >
            <div
                style={{
                    background: "#fff",
                    padding: "20px",
                    borderRadius: "8px",
                    maxWidth: "400px",
                    width: "90%",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                }}
            >
                <h3 style={{ marginTop: 0 }}>{title}</h3>
                <div style={{ marginBottom: "20px" }}>{children}</div>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "8px",
                    }}
                >
                    {onCancel && (
                        <button className="ghost" onClick={onCancel}>
                            {cancelText}
                        </button>
                    )}
                    <button onClick={onClose}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
}
