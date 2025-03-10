# Groups.io Search Tool

A Node.js script to search groups.io archives.

## Installation

```bash
npm install
```

## Configuration

You can configure the app in two ways:

### 1. Using a .env file (recommended)

Copy the `.env.template` file to `.env` and fill in your credentials:

```bash
cp .env.template .env
# Edit the .env file with your information
```

### 2. Using command line arguments

```bash
node index.js --email "your.email@example.com" --password "your-password" --query "search term" --id 12345
```

Or using short options:

```bash
node index.js -e "your.email@example.com" -p "your-password" -q "search term" -i 12345
```

## Usage

### Group Identification

You must specify either a group ID or a group name (but not both):

- `--id` or `-i`: Specify the group ID
- `--group-name` or `-g`: Specify the group name

### Required Parameters

- `--query` or `-q`: The search term to look for

### Display Options

- `--format` or `-f`: Output format (default: body-only)
  - `body-only`: Only show message content
  - `full`: Show all message details
  - `summary`: Show condensed summary of each message

### Output Options

- `--output` or `-o`: Optional file path to save results
  - If not specified, results are displayed on the console

### Examples

Basic search with console output:
```bash
node index.js -e "your.email@example.com" -p "your-password" -q "search term" -i 12345
```

Search with a specific format:
```bash
node index.js -q "search term" -g "group-name" -f summary
```

Search and save to file:
```bash
node index.js -q "search term" -i 12345 -o results.json
```

With configuration in .env file:
```bash
node index.js -q "search term" -f full
```

## Security Note

It's recommended to not include your password directly in the command line. Use the .env file instead.
