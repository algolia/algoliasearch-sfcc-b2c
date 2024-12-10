'use strict';

/**
 * Retrieves the first child folder within the specified parent folder path.
 *
 * @param {dw.io.File} folder The path to the parent folder.
 * @returns {dw.io.File|null} The first child folder as a `dw.io.File` instance, or `null` if no child folders are found.
 */
function getFirstChildFolder(folder) {
    if (!empty(folder) && folder.isDirectory()) {
        var files = folder.listFiles();
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (file.isDirectory()) {
                return file;
            }
        }
    }

    return null;
}

/**
 * Retrieves the list of delta export zips from the specified folder.
 *
 * @param {dw.io.File} folder The folder containing the zip files.
 * @returns {string[]} An array of zip file names which match the pattern.
 */
function getDeltaExportZipList(folder) {

    // return all file names in export folder as an array of strings
    var exportDirFiles = folder.list(); // returns an array of strings with the files or null if not a folder

    // if delta export folder is empty or doesn't exist, don't continue
    if (empty(exportDirFiles) || !folder.isDirectory()) {
        return [];
    } else {
        // filter and sort file names - results returned by list() are unsorted
        return exportDirFiles.filter(function(file) {
            return !!file.match(/^\d{6}\.zip$/); // file name must be a six-character sequential number with a .zip extension
        }).sort();
    }
}

/**
 * Retrieves the child folders of a given folder.
 *
 * @param {dw.io.File} folder The folder to be searched
 * @returns {dw.io.File[]} An array of subfolders
 */
function getChildFolders(folder) {
    if (empty(folder) || !folder.isDirectory()) {
        return [];
    } else {
        return folder.listFiles(function(file) {
            return file.isDirectory();
        }).toArray().sort();
    }
}

/**
 * Returns an array of all XML files from the given folder
 * @param {dw.io.File} folder Folder to list files in
 * @returns {Array} An array of strings
 */
function getAllXMLFilesInFolder(folder) {
    if (empty(folder) || !folder.isDirectory()) {
        return [];
    } else {
        return folder.listFiles(function(file) {
            return file.isFile() && file.getName().endsWith('.xml');
        }).toArray().sort();
    }
}

/**
 * Recursively removes a folder and its contents that are older than a specified date.
 * If no maxDate is provided (or if it is 0), it removes all items unconditionally.
 *
 * @param {dw.io.File} folder - The folder to remove (of class File)
 * @param {number} [maxDate=0] - The maximum allowed lastModified timestamp (in ms).
 *                               Items older than this timestamp will be removed.
 *                               If set to 0 (the default), all items are removed.
 * @returns {boolean} - True if removal succeeded for all targeted items, false otherwise.
 */
function removeFolderRecursively(folder, maxDate) {
    var success = true;
    maxDate = maxDate || 0; // Default to 0 if not provided

    if (folder.exists() && folder.isDirectory()) {
        var files = folder.listFiles().toArray();

        files.forEach(function(file) {
            var shouldRemove = true;
            if (maxDate > 0) {
                // Check if file/folder is older than maxDate
                var lastModified = file.lastModified();
                shouldRemove = lastModified < maxDate;
            }

            if (file.isDirectory()) {
                // Recursively remove subfolder contents that meet the criteria
                var subSuccess = removeFolderRecursively(file, maxDate);

                // Attempt to remove the directory itself only if it meets the criteria and was successfully processed
                if (subSuccess && shouldRemove) {
                    // In case removal didn't happen in recursion (if folder was empty after recursion, it gets removed here)
                    // If it's still there after recursion, try removing now.
                    subSuccess = file.remove();
                }

                success = success && subSuccess;
            } else {
                // For files, remove if they meet the criteria
                if (shouldRemove) {
                    success = success && file.remove();
                }
            }
        });

        // After processing all contents, remove the now-empty folder if it meets the criteria
        if (maxDate === 0 || folder.lastModified() < maxDate) {
            success = success && folder.remove();
        }
    }

    return success;
}

/**
 * Safely moves a file to another location
 * @param {dw.io.File} sourceFile File to move
 * @param {dw.io.File} targetFile Target path
 * @returns {boolean} whether the move was successful
 */
function moveFile(sourceFile, targetFile) {
    var success = false;
    if (sourceFile.exists()) {
        if (targetFile.exists()) {
            targetFile.remove();
        }
        success = sourceFile.copyTo(targetFile) && sourceFile.remove();
    }
    return success;
}

/**
 * Moves files generated by the delta export to another location
 * @param {string[]} deltaExportZipList List of delta export zip names
 * @param {dw.io.File} sourceDir Directory to move from
 * @param {dw.io.File} destDir Target directory
 */
function moveDeltaExportFiles(deltaExportZipList, sourceDir, destDir) {
    if (empty(deltaExportZipList)) {
        return;
    }
    deltaExportZipList.forEach(function (filename) {
        let currentZipFile = new dw.io.File(sourceDir, filename); // 000001.zip, 000002.zip, etc.
        let targetZipFile = new dw.io.File(destDir, currentZipFile.getName());
        currentZipFile.renameTo(targetZipFile);

        let currentMetaFile = new dw.io.File(sourceDir, filename.replace('.zip', '.meta')); // each .zip has a corresponding .meta file
        let targetMetaFile = new dw.io.File(destDir, currentMetaFile.getName());
        currentMetaFile.renameTo(targetMetaFile)
    });
}

module.exports = {
    getFirstChildFolder: getFirstChildFolder,
    getDeltaExportZipList: getDeltaExportZipList,
    getChildFolders: getChildFolders,
    getAllXMLFilesInFolder: getAllXMLFilesInFolder,
    removeFolderRecursively: removeFolderRecursively,
    moveFile: moveFile,
    moveDeltaExportFiles: moveDeltaExportFiles,
}
