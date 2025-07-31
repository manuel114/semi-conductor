# Deploying Revenue Maestro to Vercel

## Prerequisites
- Node.js (version 14 or higher)
- Yarn package manager
- Vercel CLI (optional, but recommended)

## Deployment Steps

### 1. Install Dependencies
```bash
yarn install
```

### 2. Test Build Locally
```bash
yarn build
```

### 3. Deploy to Vercel

#### Option A: Using Vercel CLI
```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts to configure your project
```

#### Option B: Using Vercel Dashboard
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your repository
5. Vercel will automatically detect the configuration and deploy

## Configuration

The project includes a `vercel.json` file that:
- Uses the `@vercel/static-build` builder
- Runs `yarn build` as the build command
- Serves files from the `dist` directory
- Handles routing for static assets and SPA routing

## Build Process

The build process:
1. Copies static assets to the build directory
2. Bundles the application using Parcel
3. Outputs the final build to the `dist` directory

## Environment Variables

No environment variables are required for this project.

## Custom Domain (Optional)

After deployment, you can add a custom domain in the Vercel dashboard.

## Troubleshooting

If you encounter build issues:
1. Ensure all dependencies are installed: `yarn install`
2. Test the build locally: `yarn build`
3. Check that the `dist` directory is generated
4. Verify that `index.html` exists in the `dist` directory 