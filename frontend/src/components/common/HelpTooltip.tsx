import { Popover, Transition } from '@headlessui/react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { Fragment } from 'react';

interface HelpTooltipProps {
  content: string;
  title?: string;
}

export function HelpTooltip({ content, title }: HelpTooltipProps) {
  return (
    <Popover className="relative inline-block">
      <>
        <Popover.Button
          as="span"
          className="inline-flex text-gray-400 hover:text-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded cursor-pointer"
          aria-label="Help"
          role="button"
          tabIndex={0}
        >
          <QuestionMarkCircleIcon className="w-5 h-5" />
        </Popover.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <Popover.Panel className="absolute z-10 w-80 px-4 mt-3 transform -translate-x-1/2 left-1/2 sm:px-0">
              <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                <div className="bg-gray-900 p-4">
                  {title && (
                    <p className="font-semibold text-white mb-2">{title}</p>
                  )}
                  <p className="text-sm text-gray-200">{content}</p>
                </div>
              </div>
            </Popover.Panel>
          </Transition>
      </>
    </Popover>
  );
}
