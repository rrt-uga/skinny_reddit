# Reddit Vibepoem - Devvit App

A collaborative poetry creation app built for Reddit using Devvit. Community members work together throughout the day to create a unique "skinny poem" through voting and mood setting.

## How It Works

The app runs on a daily cycle with four phases:

1. **Key Line Voting (8AM-12PM)**: Community votes on the opening/closing line
2. **Key Word Voting (12PM-4PM)**: Community selects the recurring key word
3. **Mood Setting (4PM-8PM)**: Users adjust emotional variables
4. **Generation (8PM-9PM)**: The poem is automatically generated
5. **Published**: The completed poem is displayed

## Features

- **Daily Collaborative Process**: Each day brings a new poem creation cycle
- **Community Voting**: Democratic selection of poem elements
- **Mood Variables**: 10 different emotional dimensions to influence the poem
- **Automatic Generation**: AI-powered poem assembly using community inputs
- **Redis Storage**: Persistent state management across sessions
- **Phase Timing**: Automatic progression through daily phases

## Installation

1. Clone this repository
2. Run `npm install`
3. Run `devvit login` to authenticate
4. Run `devvit upload` to deploy to Reddit

## Usage

Moderators can create new poem generator posts using the "Create Poem Generator" menu option in their subreddit. Community members can then participate by voting and setting moods during the appropriate time phases.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build the app
- `npm run upload` - Upload to Reddit
- `npm run check` - Run type checking and linting

## Architecture

This is a pure Devvit application that runs entirely within Reddit's infrastructure:

- **Frontend**: Devvit blocks-based UI
- **Backend**: Devvit serverless functions
- **Storage**: Redis for state persistence
- **Authentication**: Reddit's built-in user system

No external services or webviews are required.