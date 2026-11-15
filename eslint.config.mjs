export default [
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                console: "readonly",
                process: "readonly",
                require: "readonly",
                module: "writable",
                __dirname: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                Buffer: "readonly",
            },
        },
        rules: {
            "no-console": "off",
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        },
    },
];
