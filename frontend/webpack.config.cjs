module.exports = {
    mode: 'development',

    entry: './src/main.tsx',

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
            },
            {
                test: /\.css$/,
                use: 'css-loader',
            },
        ],
    },
    resolve: {
        extensions: [
            '.ts', '.tsx', '.js', '.css',
        ],
    },
};