// import { IconConstruction } from "@tabler/icons-react";

export function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="text-center space-y-4">
        {/* <IconConstruction className="w-16 h-16 mx-auto text-gray-400" /> */}
        <h2 className="text-2xl font-semibold text-gray-700">Coming Soon</h2>
        <p className="text-gray-500 max-w-md">
          This feature is currently under development. We're working hard to bring you an enhanced experience.
        </p>
      </div>
    </div>
  );
}

