const TestimonialItem = ({ name, role, img, feedback }) => {
  return (
    <div className="bg-[#fffeff] rounded-lg p-5 sm:p-7 md:p-14 w-full max-w-xl min-h-[320px] sm:min-h-[400px] md:min-h-[500px] flex flex-col justify-between gap-4 border-2 border-[#d9d9d9] rounded-l-[10px] rounded-r-[50px] rounded-tl-[50px] rounded-tr-[10px] select-none overflow-y-auto">
      <img
        loading="lazy"
        decoding="async"
        src="/landing/testimonial/coma.svg"
        alt="comma"
        className="w-10 sm:w-12 h-10 sm:h-12 self-end flex-shrink-0 "
      />

      <p className="my-2 sm:my-4 text-base sm:text-lg md:text-2xl w-full md:w-3/4">
        "{feedback}"
      </p>

      <div>
        <hr />
        <div className="flex items-center gap-2 mt-5">
          <img
            loading="lazy"
            decoding="async"
            src={img}
            alt={name}
            className="w-12 sm:w-14 h-12 sm:h-14 rounded-full object-cover flex-shrink-0"
          />
          <div className="min-w-0">
            <h5 className="font-bold mb-1 font-landing-title text-sm sm:text-base truncate">
              {name}
            </h5>
            <p className="text-xs text-gray-500 uppercase tracking-wider truncate">
              {role}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestimonialItem;
