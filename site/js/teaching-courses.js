/** Authored explanations; presentation is chosen separately for each mechanism. */
import { modelTeaching } from "./teaching-model.js";
import { compilerKernelTeaching } from "./teaching-compiler-kernel.js";
import { engineSystemTeaching } from "./teaching-engine-system.js";

export const teachingCourses = {
  ...modelTeaching,
  ...compilerKernelTeaching,
  ...engineSystemTeaching,
};

export const teachingFor = (id) => teachingCourses[id] || null;
