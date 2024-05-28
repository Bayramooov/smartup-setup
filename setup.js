require('dotenv').config();
const fs = require('fs-extra');
const { globSync } = require('glob');
const replace = require('replace-in-file');
const AdmZip = require('adm-zip');
const path = require('path');

// Load environment variables
const { BIRUNI_PATH, WEBAPPS_FOLDER, PROJECTS_FOLDER, EDITOR_PATH, PROJECTS } = process.env;

PROJECTS.split(',').forEach(project => {
  try {
    // ////////////////////////////////////////////////////////////////////////////////////////////////////
    // 1. Create project in webapps from biruni built bundle
    // ////////////////////////////////////////////////////////////////////////////////////////////////////

    // Define the dependency projects
    const depProjects = project.split('+');
    // Define the project name
    const projectName = depProjects[depProjects.length - 1];
    // Define the project-specific destination directory
    const webappsProjectFolder = path.join(WEBAPPS_FOLDER, projectName); // C:\Program Files\Apache Software Foundation\Tomcat 10.1\webapps\smartup5x_core

    console.log('****************************************************************************************************');
    console.log('** BUILDING:', projectName);
    console.log('** DEPENDENCIES:', depProjects.join(' + '));
    console.log('**');

    // Duplicate the zip file
    const duplicatedBiruniBundlePath = path.join(webappsProjectFolder, path.basename(BIRUNI_PATH)); // C:\Program Files\Apache Software Foundation\Tomcat 10.1\webapps\smartup5x_core\biruni.zip
    fs.copySync(BIRUNI_PATH, duplicatedBiruniBundlePath);
    console.log('** INFO:', `Get "${BIRUNI_PATH}"`);
    console.log('** INFO:', `Copied into "${duplicatedBiruniBundlePath}"`);

    // Unzip the file
    const zip = new AdmZip(duplicatedBiruniBundlePath);
    zip.extractAllTo(webappsProjectFolder, true);
    console.log('** INFO:', `Extracted into "${webappsProjectFolder}"`);

    // Remove the duplicated zip file after extraction
    fs.removeSync(duplicatedBiruniBundlePath);
    console.log('** INFO:', `Deleted "${duplicatedBiruniBundlePath}"`);

    // ////////////////////////////////////////////////////////////////////////////////////////////////////
    // 2. Configure webapps project web.xml file
    // ////////////////////////////////////////////////////////////////////////////////////////////////////

    // Duplicate web-template.xml to web.xml
    const webXmlPath = path.join(webappsProjectFolder, 'WEB-INF', 'web.xml'); // C:\Program Files\Apache Software Foundation\Tomcat 10.1\webapps\smartup5x_core\WEB-INF\web.xml
    const webXmlTemplatePath = path.join(webappsProjectFolder, 'WEB-INF', 'web-template.xml'); // C:\Program Files\Apache Software Foundation\Tomcat 10.1\webapps\smartup5x_core\WEB-INF\web-template.xml
    fs.copySync(webXmlTemplatePath, webXmlPath);
    console.log('** INFO:', `Get "${webXmlTemplatePath}"`);
    console.log('** INFO:', `Copied into "${webXmlPath}"`);

    // Replace lines in web.xml
    const options = {
      files: webXmlPath.replace(/\\/g, '/'),
      from: [
        /<!--\s*<context-param>\s*<param-name>projects_folder<\/param-name>\s*<param-value>path\\to\\projects<\/param-value>\s*<\/context-param>\s*-->/g,
        /<context-param>\s*<param-name>editor_path<\/param-name>\s*<param-value>c:\\Program Files \(x86\)\\Notepad\+\+\\notepad\+\+\.exe<\/param-value>\s*<!-- <param-value>C:\\Users\\username\\AppData\\Local\\Programs\\Microsoft VS Code\\Code\.exe<\/param-value> -->\s*<!-- <param-value>C:\\Program Files\\Sublime Text 3\\sublime_text\.exe<\/param-value> -->\s*<\/context-param>/g,
      ],
      to: [
        `<context-param>\n\t\t<param-name>projects_folder</param-name>\n\t\t<param-value>${PROJECTS_FOLDER}</param-value>\n\t</context-param>`,
        `<context-param>\n\t\t<param-name>editor_path</param-name>\n\t\t<param-value>${EDITOR_PATH}</param-value>\n\t</context-param>`,
      ],
    };
    const result = replace.sync(options);
    if (!result.length) throw new Error(`Couldn't edit ${webXmlPath}`);
    console.log('** INFO:', `Set web.xml projects_folder=${PROJECTS_FOLDER}`);
    console.log('** INFO:', `Set web.xml editor_path=${EDITOR_PATH}`);

    // ////////////////////////////////////////////////////////////////////////////////////////////////////
    // 3. Setup dependency .jar files into webapps lib
    // ////////////////////////////////////////////////////////////////////////////////////////////////////

    const webappsLibFolder = path.join(webappsProjectFolder, 'WEB-INF', 'lib'); // C:\Program Files\Apache Software Foundation\Tomcat 10.1\webapps\smartup5x_core\WEB-INF\lib
    depProjects.forEach(depProjectName => {
      const libPath = path.join(PROJECTS_FOLDER, depProjectName, 'release', 'lib', '*.jar'); // D:\projects\smartup5x_core\release\lib\*.jar
      console.log('**\n** INFO:', `Looking for libs in ${libPath}`);

      // Find all .jar files in the dependency folder
      const jarFilePaths = globSync(libPath.replace(/\\/g, '/'));
      if (!jarFilePaths.length) {
        console.log('** INFO:', `No .jar files found in ${libPath}`);
      }

      // Copy the project .jar files into the webapps lib
      jarFilePaths.forEach(jarPath => {
        const jarDest = path.join(webappsLibFolder, path.basename(jarPath));
        fs.copySync(jarPath, jarDest);
        console.log('** INFO:', `Found ${jarPath}`);
        console.log('** INFO:', `Copied into ${jarDest}`);
      });

      // ////////////////////////////////////////////////////////////////////////////////////////////////////
      // 4. Configure webapps project web.xml file for dependency projects
      // ////////////////////////////////////////////////////////////////////////////////////////////////////

      const depProjectWebXmlPath = path.join(PROJECTS_FOLDER, depProjectName, 'release', 'lib', 'web.xml'); // D:\projects\smartup5x_core\release\lib\web.xml
      if (fs.pathExistsSync(depProjectWebXmlPath)) {
        console.log('** INFO:', `Found web.xml in ${depProjectWebXmlPath}`);

        const options = {
          files: webXmlPath.replace(/\\/g, '/'),
          from: [/<\/web-app>/g],
          to: [`\n\n<!-- ${depProjectName} -->\n${fs.readFileSync(depProjectWebXmlPath, 'utf-8')}\n\n</web-app>`],
        };
        const result = replace.sync(options);
        if (!result.length) throw new Error(`Couldn't edit ${webXmlPath}`);
        console.log('** INFO:', `Added configs into ${webXmlPath}`);
      }
    });

    console.log('**\n** SUCCESS:', `${projectName} complete!`);
  } catch (err) {
    console.error('** ERROR:', err.message);
  } finally {
    console.log('****************************************************************************************************\n\n');
  }
});

console.log(`Finished! Browse: ${WEBAPPS_FOLDER}`);
console.log();
