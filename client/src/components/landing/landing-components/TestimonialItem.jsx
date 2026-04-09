const TestimonialItem = ({ name, role, img, feedback }) => {
  return (
    <div className="bg-[#fffeff] rounded-lg p-7 md:p-14 w-full max-w-xl min-h-[400px] md:min-h-[500px] flex flex-col justify-between gap-4 border-2 border-[#d9d9d9] rounded-l-[10px] rounded-r-[50px] rounded-tl-[50px] rounded-tr-[10px] select-none">
      <img
        src="/landing/testimonial/coma.svg"
        alt="comma"
        className="w-12 h-12 self-end"
      />

      <p className="my-4 text-lg md:text-2xl w-full md:w-3/4">"{feedback}"</p>

      <div>
        <hr />
        <div className="flex items-center gap-2 mt-5">
          <img
            src={img}
            alt={name}
            className="w-14 h-14 rounded-full object-cover"
          />
          <div>
            <h5 className="font-bold mb-1 font-landing-title">{name}</h5>
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              {role}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestimonialItem;
