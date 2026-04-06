const refernce = {
    "id": "usr_99x_7721",
    "status": "active",
    "identity": {
        "full_name": "Jesse Danie",
        "kyc_level": 3,
        "email": "jessedan160@gmail.com",
        "verified": true,
        "address": {
            "street": "123 Financial District",
            "suite": "702-B",
            "coordinates": { "lat": 40.7128, "lng": -74.0060 }
        }
    },
    "accounts": [
        {
            "account_no": "TR-9901-2281",
            "type": "CHECKING",
            "currency": "USD",
            "balance": 14500.50,
            "interest_rate": 0.01,
            "recent_transactions": [
                { "id": "tx_001", "date": "2026-04-01", "desc": "ATM Withdrawal", "amount": -200 },
                { "id": "tx_002", "date": "2026-04-02", "desc": "Payroll Deposit", "amount": 4200.75 }
            ]
        },
        {
            "account_no": "SA-4410-8832",
            "type": "SAVINGS",
            "currency": "USD",
            "balance": 102450.00,
            "apy": 4.25,
            "locked": false
        }
    ],
    "security": {
        "mfa_enabled": true,
        "last_login_ip": "192.168.1.45",
        "login_history": ["2026-04-04T09:00Z", "2026-04-05T18:30Z"],
        "device_fingerprint": "df_992_alpha_mac"
    },
    "metadata": {
        "tags": ["premium_client", "high_net_worth", "beta_user"],
        "created_at": "2024-11-12T10:00:00Z",
        "notes": null
    }
};

await MEMORY.add('bank_entity_0192', refernce); 

throw new Error("Errror");
return refernce
