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
 * Removes a folder and its contents recursively.
 * @param {dw.io.File} folder The folder to remove (of class File)
 * @returns {boolean} Success Boolean
 */
function removeFolderRecursively(folder) {
    var success = true;

    if (folder.exists() && folder.isDirectory()) {
        // generate an array of the files and folders
        var files = folder.listFiles().toArray();

        files.forEach(function(file) {
            if (file.isDirectory()) {
                // recursively remove subfolders
                success = success && removeFolderRecursively(file);
            } else {
                // remove files within the folder
                success = success && file.remove();
            }
        });

        // remove the empty folder itself
        success = success && folder.remove();
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

module.exports = {
	getFirstChildFolder: getFirstChildFolder,
	getDeltaExportZipList: getDeltaExportZipList,
	getChildFolders: getChildFolders,
	getAllXMLFilesInFolder: getAllXMLFilesInFolder,
	removeFolderRecursively: removeFolderRecursively,
	moveFile: moveFile,
}
