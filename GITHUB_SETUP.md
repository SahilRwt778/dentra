# Publish Dentra to GitHub

Use one private repository containing the entire `sudanta` folder. Both mobile apps depend on local code in `packages/`; separate app repositories alone will not contain those dependencies.

## Create an empty remote

On [GitHub's New repository page](https://github.com/new), select your account or organization, name the repository `dentra`, and select **Private**. Leave README, .gitignore and license initialization disabled because these files already exist locally. Copy the repository's HTTPS or SSH URL.

## Preserve the existing mobile repositories

The workspace currently has two nested repositories: `dentraDentist/.git` and `dentra-mobile-patient/.git`. Back up their metadata outside this folder before creating the root repository. Otherwise Git will stage the apps as embedded repositories instead of including their source files.

Run this once, before `git init` at the workspace root:

```sh
cd /Users/deepanshu/Documents/sudanta
dentra_git_backup="../dentra-git-history-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$dentra_git_backup"
mv dentraDentist/.git "$dentra_git_backup/dentraDentist.git"
mv dentra-mobile-patient/.git "$dentra_git_backup/dentra-mobile-patient.git"
```

This moves only Git metadata. Source files remain in place, and the previous mobile histories remain in the backup folder. The new root repository starts with a fresh initial commit. These commands have not been run by the development agent.

## Review and commit the source

The root `.gitignore` excludes environment files, Firebase service-account keys, private uploads, local Firebase app configuration, signing keys, installed dependencies, Pods and build artifacts. Environment examples, package lockfiles, Pod lockfiles, native projects, shared packages, migrations and the prototype remain part of the source.

```sh
git init -b main
git add .
git status --short
git diff --cached --stat
git diff --cached --name-only
```

Review the staged paths before the first commit. They must not include `.env`, `.secrets`, patient uploads or signing credentials. Check that the mobile folders contain their source files rather than a single gitlink entry. Then commit:

```sh
git commit -m "Initial Dentra application with LiveKit consultations"
```

## Connect and push

Replace `YOUR-ACCOUNT` with the account/organization you selected:

```sh
git remote add origin https://github.com/YOUR-ACCOUNT/dentra.git
git remote -v
git push -u origin main
```

Authenticate through GitHub's browser/credential-manager flow, an existing SSH key, or GitHub CLI. GitHub account passwords cannot authenticate Git HTTPS pushes. Keep tokens out of the remote URL and source files.

After pushing, verify that all five application folders and `packages/` appear in GitHub. New checkouts need environment files and Firebase app configuration supplied separately. Follow the application READMEs and [LiveKit setup](LIVEKIT_SETUP.md) to install dependencies, resolve iOS pods and configure the API. The `.git` backups, local environment and private data are not uploaded by this workflow.

Reference: [GitHub's guide to adding local code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
